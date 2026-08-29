-- Captured before focused foundation priority patch on 2026-08-23.
-- Function: obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)
CREATE OR REPLACE FUNCTION public.obs_get_next_focused_question_v2(p_user_id uuid, p_attempt_id uuid, p_unit_key text DEFAULT NULL::text, p_book_code text DEFAULT NULL::text, p_start_chapter integer DEFAULT NULL::integer, p_end_chapter integer DEFAULT NULL::integer, p_dimension_key text DEFAULT NULL::text)
 RETURNS TABLE(out_generated_question_id uuid, prompt text, question_type text, choices jsonb, event_title text, book_code text, importance_tier integer, section text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with config as (
    select *
    from public.obs_router_policy_config
    where policy_key = 'OT_GENERAL'
  ),
  authorized as (
    select 1
    where auth.uid() = p_user_id
  ),
  advanced_state as (
    select public.obs_advanced_dimension_unlocked(
      p_user_id,
      now()
    ) as unlocked
  ),
  target as (
    select
      unit.*,
      dimension.short_label as dimension_short_label,
      coalesce(dimension.is_advanced, false) as dimension_is_advanced
    from public.obs_learning_units unit
    join authorized on true
    left join public.obs_bli_dimensions dimension
      on dimension.dimension_key
        = public.obs_normalize_dimension_key(p_dimension_key)
    where (
      p_unit_key is not null
      and unit.unit_key = p_unit_key
    )
      or (
        p_unit_key is null
        and p_book_code is not null
        and unit.book_code = upper(p_book_code)
        and unit.start_chapter = p_start_chapter
        and unit.end_chapter = p_end_chapter
      )
    order by unit.sequence_order
    limit 1
  ),
  user_history as (
    select
      answer.generated_question_id,
      count(*)::integer as times_answered,
      max(answer.answered_at) as last_answered_at
    from public.assessment_answers answer
    where answer.user_id = p_user_id
      and answer.generated_question_id is not null
    group by answer.generated_question_id
  ),
  candidate_base as (
    select
      question.*,
      case
        when target.dimension_short_label is null
          then coalesce(
            target.label,
            question.unit_label,
            question.book_code || ' focused retest'
          )
        else target.dimension_short_label || ' in ' || target.label
      end as target_label,
      coalesce(
        target.section,
        question.unit_section,
        'Old Testament'
      ) as target_section,
      public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) as difficulty_stage,
      public.obs_effective_item_irt_b(
        question.payload,
        event.irt_b::double precision
      ) as effective_irt_b,
      coalesce(history.times_answered, 0) as times_answered,
      history.last_answered_at,
      public.obs_router_repeat_bucket(
        history.last_answered_at,
        now(),
        config.focused_repeat_cooldown_days
      ) as repeat_cooldown_bucket,
      exists (
        select 1
        from public.assessment_answers answer
        where answer.user_id = p_user_id
          and answer.generated_question_id
            = question.generated_question_id
          and answer.attempt_id = p_attempt_id
      ) as answered_in_attempt
    from public.obs_question_bank_with_units question
    join target on true
    cross join config
    cross join advanced_state advanced
    left join public.bible_events event
      on event.id = question.event_id
    left join user_history history
      on history.generated_question_id = question.generated_question_id
    where question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and (
        p_dimension_key is null
        or question.dimension_key
          = public.obs_normalize_dimension_key(p_dimension_key)
      )
      and (
        not target.dimension_is_advanced
        or advanced.unlocked
      )
      and (
        question.unit_key = target.unit_key
        or (
          target.start_chapter = 1
          and question.book_code = target.book_code
          and question.question_type = 'book_orientation_mcq_v1'
        )
      )
  ),
  availability as (
    select
      count(*) filter (
        where difficulty_stage = 1
      )::integer as stage_1_available,
      count(*) filter (
        where difficulty_stage = 2
      )::integer as stage_2_available,
      count(*) filter (
        where difficulty_stage = 3
      )::integer as stage_3_available
    from candidate_base
  ),
  attempt_answer_rows as (
    select
      classified.stage,
      answer.is_correct,
      coalesce(answer.is_idk, false) as is_idk,
      row_number() over (
        order by answer.answered_at desc, answer.id desc
      ) as recency_rank
    from public.assessment_answers answer
    join public.obs_question_bank_with_units question
      on question.generated_question_id = answer.generated_question_id
    left join public.bible_events event
      on event.id = question.event_id
    cross join lateral (
      select public.obs_focused_item_stage(
        question.question_type,
        question.payload,
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) as stage
    ) classified
    where answer.attempt_id = p_attempt_id
      and answer.user_id = p_user_id
  ),
  attempt_progress as (
    select
      count(*) filter (
        where stage = 1
      )::integer as stage_1_answered,
      count(*) filter (
        where stage = 1 and is_correct and not is_idk
      )::integer as stage_1_correct,
      count(*) filter (
        where stage = 2
      )::integer as stage_2_answered,
      count(*) filter (
        where stage = 2 and is_correct and not is_idk
      )::integer as stage_2_correct,
      count(*) filter (
        where stage = 3
      )::integer as stage_3_answered,
      count(*) filter (
        where stage = 3 and is_correct and not is_idk
      )::integer as stage_3_correct,
      max(stage) filter (
        where recency_rank = 1
      )::integer as latest_stage,
      coalesce(
        bool_or(is_correct and not is_idk) filter (
          where recency_rank = 1
        ),
        true
      ) as latest_correct
    from attempt_answer_rows
  ),
  desired as (
    select case
      when not progress.latest_correct
        and coalesce(progress.latest_stage, 1) >= 2
        then greatest(1, progress.latest_stage - 1)
      when not progress.latest_correct
        and coalesce(progress.latest_stage, 1) = 1
        then 1
      when availability.stage_1_available > 0
        and progress.stage_1_answered
          < least(2, availability.stage_1_available)
        then 1
      when progress.stage_1_answered > 0
        and progress.stage_1_correct::numeric
          / progress.stage_1_answered < 0.67
        and availability.stage_1_available > 0
        then 1
      when availability.stage_2_available > 0
        and progress.stage_2_answered
          < least(4, availability.stage_2_available)
        then 2
      when progress.stage_2_answered > 0
        and progress.stage_2_correct::numeric
          / progress.stage_2_answered < 0.60
        and availability.stage_2_available > 0
        then 2
      else 3
    end as difficulty_stage
    from availability
    cross join attempt_progress progress
  ),
  ranked as (
    select candidate.*
    from candidate_base candidate
    cross join desired
    where not candidate.answered_in_attempt
      and (
        desired.difficulty_stage <> 3
        or candidate.difficulty_stage = 3
      )
      and not exists (
        select 1
        from public.assessment_answers prior
        join public.ot_generated_questions prior_question
          on prior_question.id = prior.generated_question_id
        where prior.attempt_id = p_attempt_id
          and prior.user_id = p_user_id
          and coalesce(
            nullif(prior_question.payload->>'stem_family', ''),
            prior_question.id::text
          ) = coalesce(
            nullif(candidate.payload->>'stem_family', ''),
            candidate.generated_question_id::text
          )
      )
    order by
      candidate.repeat_cooldown_bucket,
      abs(candidate.difficulty_stage - desired.difficulty_stage),
      case
        when candidate.difficulty_stage > desired.difficulty_stage
          then 1
        else 0
      end,
      candidate.times_answered,
      candidate.last_answered_at nulls first,
      candidate.effective_irt_b,
      coalesce(
        candidate.importance_conceptual,
        candidate.routing_score,
        candidate.importance_context,
        50
      ) desc,
      random() * 0.05,
      candidate.created_at desc
    limit 1
  )
  select
    generated_question_id,
    coalesce(payload->>'prompt', prompt),
    question_type,
    payload->'choices',
    target_label,
    book_code,
    case
      when coalesce(routing_score, 0) >= 80 then 1
      when coalesce(routing_score, 0) >= 60 then 2
      else 3
    end,
    target_section
  from ranked;
$function$


-- Function: obs_rank_ot_assessment_candidates_v5(uuid,uuid,text,integer,timestamp with time zone,integer)
CREATE OR REPLACE FUNCTION public.obs_rank_ot_assessment_candidates_v5(p_attempt_id uuid, p_user_id uuid, p_policy text DEFAULT 'V5'::text, p_answer_limit integer DEFAULT NULL::integer, p_as_of timestamp with time zone DEFAULT now(), p_limit integer DEFAULT 25)
 RETURNS TABLE(candidate_rank bigint, generated_question_id uuid, prompt text, question_type text, payload jsonb, event_title text, book_code text, section text, importance_tier integer, dimension_key text, question_family text, candidate_stage integer, target_stage integer, target_theta double precision, theta_se double precision, theta_source text, route_priority integer, selection_lane text, information_score double precision, information_reliability double precision, calibration_responses integer, adaptive_score double precision, times_answered integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with v4_base as (
    select *
    from public.obs_rank_ot_assessment_candidates_v4(
      p_attempt_id,
      p_user_id,
      'V4',
      p_answer_limit,
      coalesce(p_as_of, now()),
      greatest(25, least(coalesce(p_limit, 25) * 2, 75))
    )
  ), supplemental_screens as (
    select
      (
        200 + row_number() over (
          order by question.generated_question_id
        )
      )::bigint as candidate_rank,
      question.generated_question_id,
      question.prompt,
      question.question_type,
      question.payload,
      event.event_title,
      question.book_code,
      case question.payload->>'section_key'
        when 'TORAH' then 'Torah'
        when 'FORMER' then 'Former Prophets'
        when 'LATTER' then 'Latter Prophets'
        when 'WRITINGS' then 'Writings'
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
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) as candidate_stage,
      2 as target_stage,
      coalesce(
        ability.theta - 0.5 * coalesce(ability.theta_se, 1.0),
        0.0
      ) as target_theta,
      coalesce(ability.theta_se, 1.0) as theta_se,
      case when ability.user_id is null
        then 'SECTION_SCREEN_FALLBACK'
        else 'SECTION_ABILITY_LCB'
      end as theta_source,
      0 as route_priority,
      'SECTION_SCREEN'::text as selection_lane,
      public.obs_item_information(
        coalesce(
          ability.theta - 0.5 * coalesce(ability.theta_se, 1.0),
          0.0
        ),
        public.obs_effective_item_irt_a(
          question.payload,
          event.irt_a::double precision
        ),
        public.obs_effective_item_irt_b(
          question.payload,
          event.irt_b::double precision
        )
      ) as information_score,
      0.50::double precision as information_reliability,
      0 as calibration_responses,
      (
        0.25 * public.obs_item_information(
          coalesce(
            ability.theta - 0.5 * coalesce(ability.theta_se, 1.0),
            0.0
          ),
          public.obs_effective_item_irt_a(
            question.payload,
            event.irt_a::double precision
          ),
          public.obs_effective_item_irt_b(
            question.payload,
            event.irt_b::double precision
          )
        )
        + 0.18 * least(
          1.0,
          greatest(
            0.0,
            coalesce(question.importance_conceptual, 0) / 100.0
          )
        )
      ) as adaptive_score,
      coalesce(history.times_answered, 0) as times_answered
    from public.assessment_attempts attempt
    join public.obs_question_bank_with_dimensions question
      on lower(coalesce(question.payload->>'measurement_scope', '')) = 'section'
     and lower(coalesce(question.payload->>'question_family', '')) = 'section_screen'
    left join public.bible_events event
      on event.id = question.event_id
    left join public.user_abilities ability
      on ability.user_id = p_user_id
     and ability.scope = question.payload->>'section_key'
    left join lateral (
      select count(*)::integer as times_answered
      from public.assessment_answers previous
      where previous.user_id = p_user_id
        and previous.generated_question_id = question.generated_question_id
    ) history on true
    where attempt.id = p_attempt_id
      and attempt.user_id = p_user_id
      and upper(coalesce(attempt.testament, 'OT')) = 'OT'
      and upper(coalesce(attempt.scope_key, 'OT')) = 'OT'
      and question.question_type = 'section_screen_mcq_v1'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and jsonb_array_length(question.payload->'choices') = 4
      and not exists (
        select 1
        from public.assessment_answers used
        where used.attempt_id = p_attempt_id
          and used.user_id = p_user_id
          and used.generated_question_id = question.generated_question_id
      )
      and not exists (
        select 1
        from public.assessment_answers used
        join public.ot_generated_questions used_question
          on used_question.id = used.generated_question_id
        where used.attempt_id = p_attempt_id
          and used.user_id = p_user_id
          and nullif(question.payload->>'stem_family', '') is not null
          and used_question.payload->>'stem_family'
            = question.payload->>'stem_family'
      )
      and not exists (
        select 1
        from v4_base existing
        where existing.generated_question_id = question.generated_question_id
      )
  ), base as (
    select * from v4_base
    union all
    select * from supplemental_screens
  ), ordered_answers as (
    select
      answer.id,
      answer.is_correct,
      coalesce(answer.is_idk, false) as is_idk,
      question.payload,
      public.obs_ot_section_screen_key(
        question.payload,
        coalesce(
          question.payload->>'book_code',
          event.book_code
        )
      ) as section_key,
      row_number() over (
        order by answer.answered_at, answer.id
      )::integer as answer_order
    from public.assessment_answers answer
    join public.ot_generated_questions question
      on question.id = answer.generated_question_id
    left join public.bible_events event
      on event.id = question.event_id
    where answer.attempt_id = p_attempt_id
      and answer.user_id = p_user_id
      and answer.answered_at <= coalesce(p_as_of, now())
  ), included_answers as (
    select *
    from ordered_answers
    where p_answer_limit is null
       or answer_order <= greatest(0, p_answer_limit)
  ), section_evidence as (
    select
      section_key,
      count(*) filter (
        where lower(coalesce(payload->>'measurement_scope', '')) = 'section'
          and lower(coalesce(payload->>'question_family', '')) = 'section_screen'
      )::integer as screen_answered,
      count(*) filter (
        where lower(coalesce(payload->>'measurement_scope', '')) = 'section'
          and lower(coalesce(payload->>'question_family', '')) = 'section_screen'
          and is_correct
          and not is_idk
      )::integer as screen_correct,
      count(*) filter (
        where not (
          lower(coalesce(payload->>'measurement_scope', '')) = 'section'
          and lower(coalesce(payload->>'question_family', '')) = 'section_screen'
        )
      )::integer as detail_answered,
      count(*) filter (
        where not (
          lower(coalesce(payload->>'measurement_scope', '')) = 'section'
          and lower(coalesce(payload->>'question_family', '')) = 'section_screen'
        )
          and is_correct
          and not is_idk
      )::integer as detail_correct
    from included_answers
    where section_key in ('TORAH', 'FORMER', 'LATTER', 'WRITINGS')
    group by section_key
  ), global_evidence as (
    select
      coalesce(max(screen_answered) filter (where section_key = 'LATTER'), 0)
        as latter_screen_answered,
      coalesce(max(screen_correct) filter (where section_key = 'LATTER'), 0)
        as latter_screen_correct
    from section_evidence
  ), totals as (
    select count(*)::integer as answered_total
    from included_answers
  ), enriched as (
    select
      base.*,
      public.obs_ot_section_screen_key(base.payload, base.book_code)
        as candidate_section,
      lower(coalesce(base.payload->>'measurement_scope', '')) = 'section'
        and lower(coalesce(base.payload->>'question_family', '')) = 'section_screen'
        as is_section_screen,
      count(*) filter (
        where lower(coalesce(base.payload->>'measurement_scope', '')) = 'section'
          and lower(coalesce(base.payload->>'question_family', '')) = 'section_screen'
      ) over (
        partition by public.obs_ot_section_screen_key(
          base.payload,
          base.book_code
        )
        order by
          case
            when lower(coalesce(base.payload->>'measurement_scope', '')) = 'section'
              and lower(coalesce(base.payload->>'question_family', '')) = 'section_screen'
              then 0
            else 1
          end,
          base.information_score desc,
          base.candidate_rank
        rows between unbounded preceding and current row
      ) as section_candidate_ordinal,
      coalesce(evidence.screen_answered, 0) as screen_answered,
      coalesce(evidence.screen_correct, 0) as screen_correct,
      coalesce(evidence.detail_answered, 0) as detail_answered,
      coalesce(evidence.detail_correct, 0) as detail_correct,
      global_evidence.latter_screen_answered,
      global_evidence.latter_screen_correct,
      totals.answered_total
    from base
    left join section_evidence evidence
      on evidence.section_key = public.obs_ot_section_screen_key(
        base.payload,
        base.book_code
      )
    cross join global_evidence
    cross join totals
  ), reranked as (
    select
      enriched.*,
      row_number() over (
        order by
          case
            when is_section_screen and screen_answered < 2 then 0
            when is_section_screen
              and screen_answered = 2
              and screen_correct = 1 then 1
            when not is_section_screen then 2
            else 3
          end,
          case
            when is_section_screen then screen_answered
            else 0
          end,
          case
            when is_section_screen then section_candidate_ordinal
            else 0
          end,
          case
            -- One in every seven post-screen positions remains a broad
            -- exploration opportunity, so weak sections are never excluded.
            -- Strong Latter Prophets evidence is also treated as a positive
            -- signal for the historical spine; do not suppress Torah/Former
            -- merely because their broad screens were weak.
            when not is_section_screen
              and mod(answered_total, 7) <> 6
              and screen_answered >= 2
              and screen_correct = 0
              and not (
                candidate_section in ('TORAH', 'FORMER')
                and latter_screen_answered >= 2
                and latter_screen_correct >= 2
              ) then 1
            else 0
          end,
          case
            -- Breadth before depth: among non-screen candidates, prefer
            -- sections with fewer detail follow-ups so early noise cannot
            -- consume the remainder of the assessment.
            when not is_section_screen then least(detail_answered, 4)
            else 0
          end,
          case
            -- Give every positive or split section at least two detail checks
            -- before deepening a section that already has evidence.
            when not is_section_screen
              and detail_answered < 2
              and (
                screen_correct > 0
                or (
                  candidate_section in ('TORAH', 'FORMER')
                  and latter_screen_answered >= 2
                  and latter_screen_correct >= 2
                )
              ) then 0
            when not is_section_screen then 1
            else 0
          end,
          case
            when not is_section_screen and screen_answered > 0
              then (screen_correct + 1.0) / (screen_answered + 2.0)
            else 0.5
          end desc,
          case
            when not is_section_screen and detail_answered > 0
              then (detail_correct + 1.0) / (detail_answered + 2.0)
            else 0.5
          end desc,
          case candidate_section
            when 'TORAH' then 1
            when 'FORMER' then 2
            when 'LATTER' then 3
            when 'WRITINGS' then 4
            else 5
          end,
          information_score desc,
          candidate_rank
      ) as v5_rank
    from enriched
  )
  select
    reranked.v5_rank,
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
      when reranked.is_section_screen then 'SECTION_SCREEN'
      else reranked.selection_lane
    end,
    reranked.information_score,
    reranked.information_reliability,
    reranked.calibration_responses,
    reranked.adaptive_score,
    reranked.times_answered
  from reranked
  where reranked.v5_rank <= greatest(1, least(coalesce(p_limit, 25), 200))
  order by reranked.v5_rank;
$function$


-- Function: obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamp with time zone,integer)
CREATE OR REPLACE FUNCTION public.obs_rank_ot_assessment_candidates_v6(p_attempt_id uuid, p_user_id uuid, p_policy text DEFAULT 'V6'::text, p_answer_limit integer DEFAULT NULL::integer, p_as_of timestamp with time zone DEFAULT now(), p_limit integer DEFAULT 25)
 RETURNS TABLE(candidate_rank bigint, generated_question_id uuid, prompt text, question_type text, payload jsonb, event_title text, book_code text, section text, importance_tier integer, dimension_key text, question_family text, candidate_stage integer, target_stage integer, target_theta double precision, theta_se double precision, theta_source text, route_priority integer, selection_lane text, information_score double precision, information_reliability double precision, calibration_responses integer, adaptive_score double precision, times_answered integer, routing_mode text, campaign_phase text, campaign_match text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      on question.dimension_key is not distinct from campaign_scope.dimension_key
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
        when base.dimension_key is distinct from campaign_scope.dimension_key
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
            -- Campaign candidates are promoted first. In cold_start/sweep,
            -- section screens keep v5's judgement, but ordinary ranked
            -- candidates are allowed to move by dimension debt before v5's
            -- old route buckets. This is the bug fix: dimension_need already
            -- existed in v4, but v5 precedence made it mostly a tie-breaker.
            when eligible.routing_mode <> 'campaign' then 1
            when eligible.is_campaign_pick then 0
            else 1
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
$function$
