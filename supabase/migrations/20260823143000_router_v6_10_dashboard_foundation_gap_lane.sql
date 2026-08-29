-- Router v6, step 10: dashboard foundation-gap lane.
--
-- Align the general OT ranker with the dashboard recommendation engine. When
-- the dashboard is asking for a unit-level foundation gap, the general
-- assessment path should be able to serve that unit's unanswered stage-1 item
-- instead of drifting through ordinary explore/screen candidates.
--
-- Once active, cold_start keeps the fast section scan for only the opening
-- items; after that v6 reranks a wider v5 pool so dimension debt can shape the
-- distribution instead of being trapped behind v5's hard route-priority
-- buckets.
--
-- In campaign mode the targeted cell's items are unioned in from the bank
-- directly and then promoted; the v5 "breadth before depth" rerank is
-- deliberately inverted for those items. v5 orders non-screen candidates by
-- least(detail_answered, 4) ascending, which spreads follow-ups across
-- sections; that is right for building a first picture but wrong when it turns
-- dimension_need into a tie-breaker. v6 lifts campaign-matching candidates
-- above that ordering and lets dimension debt rebalance normal cold_start /
-- sweep candidates after the opening scan.
--
-- Two caps keep a campaign honest:
--   * campaign_max_items_per_attempt -- one thesis can never eat a sitting.
--   * the stage ceiling on the campaign row, which only rises once a stage
--     has actually been passed. Foundational-first is an ORDERING on
--     candidate_stage, not an exclusion -- excluding above the floor
--     deadlocks any cell holding no stage-1 items.
--
-- This function is STABLE and writes nothing. Campaign phase transitions are
-- the job of obs_router_sync_campaign, called by the volatile question RPC.
--
-- Installed but unreachable: get_next_assessment_question still calls v5 until
-- step 6.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regprocedure(
       'public.obs_rank_ot_assessment_candidates_v5(uuid,uuid,text,integer,timestamptz,integer)'
     ) is null
     or to_regprocedure('public.obs_router_mode(uuid)') is null
     or to_regclass('public.obs_router_campaign') is null
     or to_regclass('public.obs_question_bank_with_units') is null
     or to_regclass('public.obs_learning_units') is null
     or to_regprocedure('public.obs_get_ladder_state_v1(uuid)') is null
     or to_regprocedure('public.obs_unit_has_foundation_items(text)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 10 prerequisites are missing; nothing was changed.';
  end if;
end
$$;

create or replace function public.obs_rank_ot_assessment_candidates_v6(
  p_attempt_id uuid,
  p_user_id uuid,
  p_policy text default 'V6',
  p_answer_limit integer default null,
  p_as_of timestamptz default now(),
  p_limit integer default 25
)
returns table (
  candidate_rank bigint,
  generated_question_id uuid,
  prompt text,
  question_type text,
  payload jsonb,
  event_title text,
  book_code text,
  section text,
  importance_tier integer,
  dimension_key text,
  question_family text,
  candidate_stage integer,
  target_stage integer,
  target_theta double precision,
  theta_se double precision,
  theta_source text,
  route_priority integer,
  selection_lane text,
  information_score double precision,
  information_reliability double precision,
  calibration_responses integer,
  adaptive_score double precision,
  times_answered integer,
  routing_mode text,
  campaign_phase text,
  campaign_match text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with mode as (
    select public.obs_router_mode(p_user_id) as routing_mode
  ),
  policy as (
    select
      coalesce(config.campaign_max_items_per_attempt, 12) as max_items_per_attempt
    from public.obs_router_policy_config config
    where config.policy_key = 'OT_GENERAL'
  ),
  policy_or_default as (
    select coalesce((select max_items_per_attempt from policy), 12)
      as max_items_per_attempt
  ),
  attempt_scope as (
    select
      upper(coalesce(attempt.testament, 'OT')) as testament,
      upper(coalesce(attempt.scope_key, 'OT')) as scope_key
    from public.assessment_attempts attempt
    where attempt.id = p_attempt_id
      and attempt.user_id = p_user_id
    limit 1
  ),
  answer_totals as (
    select count(*) filter (where answer.scoring_eligible)::double precision
      as scoring_answered
    from public.assessment_answers answer
    where answer.attempt_id = p_attempt_id
      and answer.user_id = p_user_id
      and answer.answered_at <= coalesce(p_as_of, now())
  ),
  dimension_targets as (
    select
      target.dimension_key,
      sum(target.target_active_questions)::double precision
        / nullif(sum(sum(target.target_active_questions)) over (), 0)
        as target_share
    from public.question_coverage_targets target
    join public.obs_bli_dimensions dimension
      on dimension.dimension_key = target.dimension_key
    cross join attempt_scope attempt
    where target.target_active_questions > 0
      and public.question_matches_assessment_scope(
        target.book_code,
        attempt.testament,
        attempt.scope_key
      )
      and not coalesce(dimension.is_advanced, false)
    group by target.dimension_key
  ),
  dimension_observed as (
    select
      question.dimension_key,
      count(*) filter (where answer.scoring_eligible)::double precision
        / nullif((select scoring_answered from answer_totals), 0)
        as observed_share
    from public.assessment_answers answer
    join public.obs_question_bank_with_dimensions question
      on question.generated_question_id = answer.generated_question_id
    where answer.attempt_id = p_attempt_id
      and answer.user_id = p_user_id
      and answer.answered_at <= coalesce(p_as_of, now())
      and question.dimension_key is not null
    group by question.dimension_key
  ),
  campaign as (
    select *
    from public.obs_router_campaign campaign_row
    where campaign_row.user_id = p_user_id
      and campaign_row.closed_at is null
    limit 1
  ),
  campaign_scope as (
    -- The unit the campaign targets, plus its book and section, so the widen
    -- phases can address siblings without a second lookup.
    select
      campaign.id,
      campaign.phase,
      campaign.dimension_key,
      campaign.unit_key,
      campaign.stage_floor,
      campaign.stage_ceiling,
      coalesce(campaign.book_code, unit.book_code) as book_code,
      unit.section
    from campaign
    left join public.obs_learning_units unit
      on unit.unit_key = campaign.unit_key
  ),
  -- How much of THIS attempt the campaign has already taken. The cap is per
  -- attempt, so a long-running campaign still leaves breadth in every sitting.
  campaign_spend_this_attempt as (
    select count(*)::integer as spent
    from public.assessment_answers answer
    join public.obs_question_bank_with_units question
      on question.generated_question_id = answer.generated_question_id
    cross join campaign_scope
    where answer.attempt_id = p_attempt_id
      and answer.user_id = p_user_id
      and answer.answered_at <= coalesce(p_as_of, now())
      and question.dimension_key is not distinct from campaign_scope.dimension_key
      and (
        question.unit_key = campaign_scope.unit_key
        or question.book_code = campaign_scope.book_code
      )
  ),
  base as (
    -- v5 is NOT limit-stable: its section_candidate_ordinal is a window over
    -- whatever candidate pool it was handed, so asking it for 75 rows and
    -- taking the top 25 does not equal asking it for 25. Verified against
    -- production -- a 3x pool moved 18 of 25 positions.
    --
    -- v6 now uses that deliberately. Campaign mode needs reach into a target
    -- cell; post-opening cold_start and sweep need enough breadth for
    -- dimension debt to matter. The opening fast selector still handles the
    -- first section scan before this ranker is asked for a question.
    select *
    from public.obs_rank_ot_assessment_candidates_v5(
      p_attempt_id,
      p_user_id,
      'V5',
      p_answer_limit,
      coalesce(p_as_of, now()),
      case
        when (select routing_mode from mode) in ('campaign', 'cold_start', 'sweep')
          then greatest(25, least(coalesce(p_limit, 25) * 3, 150))
        else coalesce(p_limit, 25)
      end
    )
  ),
  dashboard_foundation_gap as (
    select ladder.unit_key
    from public.obs_get_ladder_state_v1(p_user_id) ladder
    where ladder.is_focus
      and ladder.state = 'insufficient_evidence'
      and public.obs_unit_has_foundation_items(ladder.unit_key)
      and not exists (
        select 1
        from public.assessment_answers answer
        join public.obs_question_bank_with_units question
          on question.generated_question_id = answer.generated_question_id
        left join public.bible_events event
          on event.id = question.event_id
        where answer.user_id = p_user_id
          and answer.scoring_eligible
          and question.unit_key = ladder.unit_key
          and public.obs_focused_item_stage(
            question.question_type,
            question.payload,
            public.obs_effective_item_irt_b(question.payload, event.irt_b::double precision)
          ) = 1
      )
    order by ladder.sequence_order
    limit 1
  ),
  dashboard_foundation_candidates as (
    select
      (350 + row_number() over (
        order by
          coalesce(history.times_answered, 0),
          question.created_at desc,
          question.generated_question_id
      ))::bigint as candidate_rank,
      question.generated_question_id,
      coalesce(question.payload->>'prompt', question.prompt) as prompt,
      question.question_type,
      question.payload,
      event.event_title,
      question.book_code,
      case unit.section
        when 'Torah' then 'Torah'
        when 'Former Prophets' then 'Former Prophets'
        when 'Latter Prophets' then 'Latter Prophets'
        when 'Writings' then 'Writings'
        else 'Old Testament'
      end as section,
      case
        when coalesce(question.importance_conceptual, question.routing_score, 0) >= 80 then 1
        when coalesce(question.importance_conceptual, question.routing_score, 0) >= 60 then 2
        else 3
      end as importance_tier,
      question.dimension_key,
      question.payload->>'question_family' as question_family,
      public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(question.payload, event.irt_b::double precision)
      ) as candidate_stage,
      1 as target_stage,
      coalesce(ability.theta - 0.5 * coalesce(ability.theta_se, 1.0), 0.0)
        as target_theta,
      coalesce(ability.theta_se, 1.0) as theta_se,
      'DASHBOARD_FOUNDATION_GAP'::text as theta_source,
      0 as route_priority,
      'DASHBOARD_FOUNDATION_GAP'::text as selection_lane,
      public.obs_item_information(
        coalesce(ability.theta - 0.5 * coalesce(ability.theta_se, 1.0), 0.0),
        public.obs_effective_item_irt_a(question.payload, event.irt_a::double precision),
        public.obs_effective_item_irt_b(question.payload, event.irt_b::double precision)
      ) as information_score,
      0.50::double precision as information_reliability,
      0 as calibration_responses,
      0.0::double precision as adaptive_score,
      coalesce(history.times_answered, 0) as times_answered
    from dashboard_foundation_gap gap
    join public.obs_question_bank_with_units question
      on question.unit_key = gap.unit_key
    left join public.obs_learning_units unit
      on unit.unit_key = question.unit_key
    left join public.bible_events event
      on event.id = question.event_id
    left join public.user_abilities ability
      on ability.user_id = p_user_id
     and ability.scope = public.canonical_assessment_scope(question.book_code)
    left join lateral (
      select count(*)::integer as times_answered
      from public.assessment_answers previous
      where previous.user_id = p_user_id
        and previous.generated_question_id = question.generated_question_id
    ) history on true
    where not exists (select 1 from campaign_scope)
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(question.payload, event.irt_b::double precision)
      ) = 1
      and not exists (
        select 1
        from public.assessment_answers used
        where used.attempt_id = p_attempt_id
          and used.user_id = p_user_id
          and used.generated_question_id = question.generated_question_id
      )
      and not exists (
        select 1
        from public.assessment_answers previous
        where previous.user_id = p_user_id
          and previous.generated_question_id = question.generated_question_id
          and previous.scoring_eligible
      )
      and not exists (
        select 1 from base existing
        where existing.generated_question_id = question.generated_question_id
      )
  ),
  -- Reordering alone cannot run a campaign. v5 ranks for breadth, so the items
  -- that would confirm or size one specific cell are usually nowhere near its
  -- top N -- measured against production, a campaign on gen-12-50 saw zero of
  -- its 38 bank items surface. Campaign candidates are therefore drawn
  -- directly from the bank and unioned in, exactly as v5 unions in its own
  -- supplemental section screens.
  campaign_candidates as (
    select
      (500 + row_number() over (
        order by
          question.generated_question_id
      ))::bigint as candidate_rank,
      question.generated_question_id,
      coalesce(question.payload->>'prompt', question.prompt) as prompt,
      question.question_type,
      question.payload,
      event.event_title,
      question.book_code,
      case unit.section
        when 'Torah' then 'Torah'
        when 'Former Prophets' then 'Former Prophets'
        when 'Latter Prophets' then 'Latter Prophets'
        when 'Writings' then 'Writings'
        else 'Old Testament'
      end as section,
      case
        when coalesce(question.importance_conceptual, question.routing_score, 0) >= 80 then 1
        when coalesce(question.importance_conceptual, question.routing_score, 0) >= 60 then 2
        else 3
      end as importance_tier,
      question.dimension_key,
      question.payload->>'question_family' as question_family,
      public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(question.payload, event.irt_b::double precision)
      ) as candidate_stage,
      campaign_scope.stage_ceiling as target_stage,
      coalesce(ability.theta - 0.5 * coalesce(ability.theta_se, 1.0), 0.0)
        as target_theta,
      coalesce(ability.theta_se, 1.0) as theta_se,
      'CAMPAIGN_SECTION_LCB'::text as theta_source,
      0 as route_priority,
      'CAMPAIGN'::text as selection_lane,
      public.obs_item_information(
        coalesce(ability.theta - 0.5 * coalesce(ability.theta_se, 1.0), 0.0),
        public.obs_effective_item_irt_a(question.payload, event.irt_a::double precision),
        public.obs_effective_item_irt_b(question.payload, event.irt_b::double precision)
      ) as information_score,
      0.50::double precision as information_reliability,
      0 as calibration_responses,
      0.0::double precision as adaptive_score,
      coalesce(history.times_answered, 0) as times_answered
    from campaign_scope
    join public.obs_question_bank_with_units question
      -- Unit-level campaigns have no dimension target; include every dimension
      -- in the unit so stage-1 foundation probes are eligible.
      on (
        campaign_scope.dimension_key is null
        or question.dimension_key is not distinct from campaign_scope.dimension_key
      )
    left join public.obs_learning_units unit
      on unit.unit_key = question.unit_key
    left join public.bible_events event
      on event.id = question.event_id
    left join public.user_abilities ability
      on ability.user_id = p_user_id
     and ability.scope = public.canonical_assessment_scope(question.book_code)
    left join lateral (
      select count(*)::integer as times_answered
      from public.assessment_answers previous
      where previous.user_id = p_user_id
        and previous.generated_question_id = question.generated_question_id
    ) history on true
    where (select routing_mode from mode) = 'campaign'
      -- Only the scope the CURRENT phase is asking about.
      and case campaign_scope.phase
        when 'confirm' then
          (campaign_scope.unit_key is not null
             and question.unit_key = campaign_scope.unit_key)
          or (campaign_scope.unit_key is null
             and question.book_code = campaign_scope.book_code)
        when 'bracket_stage' then
          (campaign_scope.unit_key is not null
             and question.unit_key = campaign_scope.unit_key)
          or (campaign_scope.unit_key is null
             and question.book_code = campaign_scope.book_code)
        when 'widen_scope' then
          question.book_code = campaign_scope.book_code
          and question.unit_key is distinct from campaign_scope.unit_key
        when 'widen_sibling' then
          unit.section = campaign_scope.section
          and question.book_code <> campaign_scope.book_code
        else false
      end
      and not exists (
        select 1
        from public.assessment_answers used
        where used.attempt_id = p_attempt_id
          and used.user_id = p_user_id
          and used.generated_question_id = question.generated_question_id
      )
      and not exists (
        select 1 from base existing
        where existing.generated_question_id = question.generated_question_id
      )
  ),
  pool as (
    select * from base
    union all
    select * from dashboard_foundation_candidates
    union all
    select * from campaign_candidates
  ),
  annotated as (
    select
      base.*,
      mode.routing_mode,
      campaign_scope.phase as campaign_phase,
      campaign_scope.stage_floor,
      campaign_scope.stage_ceiling,
      question.unit_key as candidate_unit_key,
      coalesce(target.target_share, 0.0) as v6_target_share,
      coalesce(observed.observed_share, 0.0) as v6_observed_share,
      greatest(
        0.0,
        coalesce(target.target_share, 0.0)
          - coalesce(observed.observed_share, 0.0)
      ) as v6_dimension_need,
      -- Book identity comes from the candidate row, not from its learning
      -- unit: only 795 of 1171 OT items carry a unit_key, and a book-scoped
      -- campaign must still be able to match the unmapped 376.
      coalesce(unit.book_code, base.book_code) as candidate_book_code,
      unit.section as candidate_unit_section,
      case
        when campaign_scope.id is null then null
        when campaign_scope.dimension_key is not null
          and base.dimension_key is distinct from campaign_scope.dimension_key
          then null
        -- confirm and bracket_stage both work the exact cell.
        when campaign_scope.unit_key is not null
          and question.unit_key = campaign_scope.unit_key
          then 'cell'
        when campaign_scope.unit_key is null
          and coalesce(unit.book_code, base.book_code) = campaign_scope.book_code
          then 'cell'
        -- widen_scope: a different chapter band of the same book.
        when coalesce(unit.book_code, base.book_code) = campaign_scope.book_code
          then 'sibling_unit'
        -- widen_sibling: a different book of the same section.
        when unit.section = campaign_scope.section
          then 'sibling_book'
        else null
      end as campaign_match
    from pool base
    cross join mode
    left join campaign_scope on true
    left join public.obs_question_bank_with_units question
      on question.generated_question_id = base.generated_question_id
    left join dimension_targets target
      on target.dimension_key = base.dimension_key
    left join dimension_observed observed
      on observed.dimension_key = base.dimension_key
    left join public.obs_learning_units unit
      on unit.unit_key = question.unit_key
  ),
  scored as (
    select
      annotated.*,
      -- Which matches the current phase actually wants. A phase asks one
      -- question; candidates that do not answer it are not campaign items.
      case
        when annotated.campaign_match is null then false
        when annotated.routing_mode <> 'campaign' then false
        when annotated.campaign_phase = 'confirm'
          then annotated.campaign_match = 'cell'
        when annotated.campaign_phase = 'widen_scope'
          then annotated.campaign_match = 'sibling_unit'
        when annotated.campaign_phase = 'widen_sibling'
          then annotated.campaign_match = 'sibling_book'
        when annotated.campaign_phase = 'bracket_stage'
          then annotated.campaign_match = 'cell'
        else false
      end as serves_phase,
      -- Foundational first is expressed by ORDERING on candidate_stage below,
      -- not by excluding everything above the floor. A hard [1,1] window
      -- rejects every stage-2 candidate and deadlocks a campaign whose cell
      -- happens to hold no stage-1 items.
      (
        annotated.candidate_stage
          <= greatest(coalesce(annotated.stage_ceiling, 2), 2)
      ) as in_stage_window
    from annotated
  ),
  eligible as (
    select
      scored.*,
      (
        scored.serves_phase
        and scored.in_stage_window
        and (
          select spent from campaign_spend_this_attempt
        ) < (select max_items_per_attempt from policy_or_default)
      ) as is_campaign_pick
    from scored
  ),
  reranked as (
    select
      eligible.*,
      row_number() over (
        order by
          case
            -- Dashboard foundation-gap candidates are promoted first when no
            -- campaign is active. They make the general assessment path honor
            -- the same unit-level foundation guard as the dashboard CTA. In
            -- cold_start/sweep,
            -- section screens keep v5's judgement, but ordinary ranked
            -- candidates are allowed to move by dimension debt before v5's
            -- old route buckets. This is the bug fix: dimension_need already
            -- existed in v4, but v5 precedence made it mostly a tie-breaker.
            when eligible.selection_lane = 'DASHBOARD_FOUNDATION_GAP' then 0
            when eligible.routing_mode = 'campaign' and eligible.is_campaign_pick then 1
            else 2
          end,
          case
            when eligible.routing_mode <> 'campaign'
              and eligible.selection_lane <> 'SECTION_SCREEN'
              and eligible.v6_dimension_need >= 0.08 then 0
            when eligible.routing_mode <> 'campaign'
              and eligible.selection_lane <> 'SECTION_SCREEN'
              and eligible.v6_dimension_need >= 0.04 then 1
            when eligible.routing_mode <> 'campaign'
              and eligible.selection_lane <> 'SECTION_SCREEN' then 2
            else 0
          end,
          case
            when eligible.routing_mode <> 'campaign'
              and eligible.selection_lane <> 'SECTION_SCREEN'
              then -eligible.v6_dimension_need
            else 0
          end,
          case
            when eligible.routing_mode <> 'campaign'
              and eligible.selection_lane <> 'SECTION_SCREEN'
              then -eligible.adaptive_score
            else 0
          end,
          -- Within the promoted set: foundational stages first, then the most
          -- informative item, then v5's own judgement.
          case
            when eligible.is_campaign_pick then eligible.candidate_stage
            else 0
          end,
          case
            when eligible.is_campaign_pick then -eligible.information_score
            else 0
          end,
          -- Never spend a campaign slot on a repeat while the cell still has
          -- unseen items; sizing an area needs distinct evidence.
          case
            when eligible.is_campaign_pick then eligible.times_answered
            else 0
          end,
          eligible.candidate_rank
      ) as v6_rank
    from eligible
  )
  select
    reranked.v6_rank,
    reranked.generated_question_id,
    reranked.prompt,
    reranked.question_type,
    reranked.payload,
    reranked.event_title,
    reranked.book_code,
    reranked.section,
    reranked.importance_tier,
    reranked.dimension_key,
    reranked.question_family,
    reranked.candidate_stage,
    reranked.target_stage,
    reranked.target_theta,
    reranked.theta_se,
    reranked.theta_source,
    reranked.route_priority,
    case
      when reranked.selection_lane = 'DASHBOARD_FOUNDATION_GAP'
        then 'FOUNDATION_GAP'
      when reranked.is_campaign_pick then 'CAMPAIGN'
      else reranked.selection_lane
    end as selection_lane,
    reranked.information_score,
    reranked.information_reliability,
    reranked.calibration_responses,
    reranked.adaptive_score,
    reranked.times_answered,
    reranked.routing_mode,
    reranked.campaign_phase,
    reranked.campaign_match
  from reranked
  where reranked.v6_rank <= greatest(1, least(coalesce(p_limit, 25), 200))
  order by reranked.v6_rank;
$$;

comment on function public.obs_rank_ot_assessment_candidates_v6(uuid, uuid, text, integer, timestamptz, integer) is
  'Mode-aware wrapper over v5. Promotes the dashboard foundation-gap item when '
  'the current recommendation is a unit-level foundation evidence gap and no '
  'campaign is active; in cold_start/sweep it widens the v5 pool and lets '
  'dimension debt outrank v5 route-bucket precedence for ordinary ranked items; '
  'in campaign mode it promotes candidates that serve the open campaign phase '
  'and sit inside its stage window, subject to a per-attempt cap. STABLE: '
  'writes nothing.';

revoke all on function public.obs_rank_ot_assessment_candidates_v6(uuid, uuid, text, integer, timestamptz, integer) from public;
grant execute on function public.obs_rank_ot_assessment_candidates_v6(uuid, uuid, text, integer, timestamptz, integer) to authenticated, service_role;

commit;
