-- Router v6, step 20: history-aware novelty and long-run soft brakes.
--
-- The 200-question asymmetric simulation showed healthy scoring and
-- same-sitting repeat prevention, but cross-attempt exact/similarity repeats
-- still leaked through the main v6 ranker. The fast cold-start selector already
-- carries retake history; this patch brings the same idea to the executing v6
-- lanes without changing any app-facing RPC signature or scoring behavior.
--
-- Suppression is expressed as ranking, not a hard exclusion. If a campaign cell
-- is truly exhausted, the router can still serve a repeat and keep progressing.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regprocedure(
       'public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)'
     ) is null
     or to_regprocedure(
       'public.obs_assessment_question_similarity_key(jsonb,text,text,text,text)'
     ) is null
     or to_regprocedure(
       'public.obs_is_high_specificity_assessment_question(text,text,jsonb)'
     ) is null
     or to_regclass('public.obs_schema_backups') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 20 prerequisites are missing; nothing was changed.';
  end if;
end
$$;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260823170000_router_v6_20_history_aware_long_run_brakes',
  'public',
  'obs_rank_ot_assessment_candidates_v6',
  'function',
  pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260823170000_router_v6_20_history_aware_long_run_brakes'
    and backup.object_name = 'obs_rank_ot_assessment_candidates_v6'
);

do $migration$
declare
  v_sql text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql like '%cross-attempt exact and similarity suppression in v6 ranker%' then
    raise notice 'Router v6 history-aware long-run brakes are already installed.';
    return;
  end if;

  v_sql := replace(
    v_sql,
$needle$
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
$needle$,
$replacement$
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
  section_targets as (
    select
      public.canonical_assessment_scope(target.book_code) as section_key,
      sum(target.target_active_questions)::double precision
        / nullif(sum(sum(target.target_active_questions)) over (), 0)
        as target_share
    from public.question_coverage_targets target
    cross join attempt_scope attempt
    where target.target_active_questions > 0
      and public.question_matches_assessment_scope(
        target.book_code,
        attempt.testament,
        attempt.scope_key
      )
    group by public.canonical_assessment_scope(target.book_code)
  ),
  long_run_answered as (
    select
      answer.generated_question_id,
      answer.attempt_id,
      answer.answered_at,
      question.book_code,
      public.canonical_assessment_scope(question.book_code) as section_key,
      question.dimension_key,
      question.question_type,
      question.payload,
      coalesce(question.payload->>'prompt', question.prompt) as prompt,
      public.obs_assessment_question_similarity_key(
        question.payload,
        question.book_code,
        question.dimension_key,
        question.question_type,
        coalesce(question.payload->>'prompt', question.prompt)
      ) as similarity_key
    from public.assessment_answers answer
    join public.obs_question_bank_with_dimensions question
      on question.generated_question_id = answer.generated_question_id
    cross join attempt_scope attempt
    where answer.user_id = p_user_id
      and answer.answered_at <= coalesce(p_as_of, now())
      and coalesce(answer.scoring_eligible, true)
      and public.question_matches_assessment_scope(
        question.book_code,
        attempt.testament,
        attempt.scope_key
      )
  ),
  long_run_totals as (
    select count(*)::double precision as scoring_answered
    from long_run_answered
  ),
  long_run_dimension_observed as (
    select
      answered.dimension_key,
      count(*)::double precision
        / nullif((select scoring_answered from long_run_totals), 0)
        as observed_share
    from long_run_answered answered
    where answered.dimension_key is not null
    group by answered.dimension_key
  ),
  long_run_section_observed as (
    select
      answered.section_key,
      count(*)::double precision
        / nullif((select scoring_answered from long_run_totals), 0)
        as observed_share
    from long_run_answered answered
    where answered.section_key is not null
    group by answered.section_key
  ),
  cross_attempt_question_history as (
    select
      answered.generated_question_id,
      count(*)::integer as seen_count,
      max(answered.answered_at) as last_seen_at
    from long_run_answered answered
    where answered.attempt_id <> p_attempt_id
    group by answered.generated_question_id
  ),
  cross_attempt_similarity_history as (
    select
      answered.similarity_key,
      count(*)::integer as seen_count,
      max(answered.answered_at) as last_seen_at
    from long_run_answered answered
    where answered.attempt_id <> p_attempt_id
      and answered.similarity_key is not null
    group by answered.similarity_key
  ),
  campaign as (
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
      unit.section as candidate_unit_section,
      case
$needle$,
$replacement$
      unit.section as candidate_unit_section,
      public.canonical_assessment_scope(coalesce(unit.book_code, base.book_code))
        as candidate_section_key,
      public.obs_assessment_question_similarity_key(
        base.payload,
        base.book_code,
        base.dimension_key,
        base.question_type,
        coalesce(base.payload->>'prompt', base.prompt)
      ) as v6_similarity_key,
      coalesce(exact_history.seen_count, 0) as v6_prior_exact_seen_count,
      exact_history.last_seen_at as v6_prior_exact_seen_at,
      coalesce(similarity_history.seen_count, 0) as v6_prior_similarity_seen_count,
      similarity_history.last_seen_at as v6_prior_similarity_seen_at,
      coalesce((select scoring_answered from long_run_totals), 0.0)
        as v6_long_run_answered,
      coalesce(long_dimension.observed_share, 0.0)
        as v6_long_run_dimension_share,
      coalesce(section_target.target_share, 0.0) as v6_section_target_share,
      coalesce(long_section.observed_share, 0.0)
        as v6_long_run_section_share,
      case
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
    left join public.obs_learning_units unit
      on unit.unit_key = question.unit_key
  ),
$needle$,
$replacement$
    left join public.obs_learning_units unit
      on unit.unit_key = question.unit_key
    left join cross_attempt_question_history exact_history
      on exact_history.generated_question_id = base.generated_question_id
    left join cross_attempt_similarity_history similarity_history
      on similarity_history.similarity_key =
        public.obs_assessment_question_similarity_key(
          base.payload,
          base.book_code,
          base.dimension_key,
          base.question_type,
          coalesce(base.payload->>'prompt', base.prompt)
        )
    left join long_run_dimension_observed long_dimension
      on long_dimension.dimension_key = base.dimension_key
    left join section_targets section_target
      on section_target.section_key =
        public.canonical_assessment_scope(coalesce(unit.book_code, base.book_code))
    left join long_run_section_observed long_section
      on long_section.section_key =
        public.canonical_assessment_scope(coalesce(unit.book_code, base.book_code))
  ),
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
          case
            -- Dashboard foundation-gap candidates are promoted first when no
            -- campaign is active. They make the general assessment path honor
            -- the same unit-level foundation guard as the dashboard CTA.
            when eligible.selection_lane = 'DASHBOARD_FOUNDATION_GAP' then 0
            when eligible.routing_mode = 'campaign' and eligible.is_campaign_pick then 1
            else 2
          end,
          case
$needle$,
$replacement$
          case
            -- Dashboard foundation-gap candidates are promoted first when no
            -- campaign is active. They make the general assessment path honor
            -- the same unit-level foundation guard as the dashboard CTA.
            when eligible.selection_lane = 'DASHBOARD_FOUNDATION_GAP' then 0
            when eligible.routing_mode = 'campaign' and eligible.is_campaign_pick then 1
            else 2
          end,
          -- cross-attempt exact and similarity suppression in v6 ranker
          case
            when eligible.selection_lane = 'DASHBOARD_FOUNDATION_GAP' then 0
            when eligible.v6_prior_exact_seen_count = 0 then 0
            when eligible.v6_prior_exact_seen_at
              > coalesce(p_as_of, now()) - interval '180 days' then 2
            else 1
          end,
          case
            when eligible.selection_lane = 'DASHBOARD_FOUNDATION_GAP' then 0
            when eligible.v6_prior_similarity_seen_count = 0 then 0
            when eligible.v6_prior_similarity_seen_at
              > coalesce(p_as_of, now()) - interval '180 days' then 2
            else 1
          end,
          -- long-run dimension max-share brake
          case
            when eligible.selection_lane = 'DASHBOARD_FOUNDATION_GAP' then 0
            when eligible.v6_long_run_answered < 40 then 0
            when eligible.dimension_key is null then 0
            when eligible.v6_long_run_dimension_share
              > greatest(
                  coalesce(eligible.v6_target_share, 0.0) + 0.06,
                  coalesce(eligible.v6_target_share, 0.0) * 1.35
                )
              then 1
            else 0
          end,
          -- long-run section max-share brake
          case
            when eligible.selection_lane = 'DASHBOARD_FOUNDATION_GAP' then 0
            when eligible.v6_long_run_answered < 40 then 0
            when eligible.candidate_section_key is null then 0
            when eligible.v6_long_run_section_share
              > greatest(
                  coalesce(eligible.v6_section_target_share, 0.0) + 0.08,
                  coalesce(eligible.v6_section_target_share, 0.0) * 1.25
                )
              then 1
            else 0
          end,
          -- broad high-specificity demotion in v6 ranker
          case
            when eligible.selection_lane = 'DASHBOARD_FOUNDATION_GAP' then 0
            when public.obs_is_high_specificity_assessment_question(
              eligible.prompt,
              eligible.question_type,
              eligible.payload
            ) then 1
            else 0
          end,
          case
$replacement$
  );

  if v_sql not like '%cross-attempt exact and similarity suppression in v6 ranker%' then
    v_sql := replace(
      v_sql,
$needle$
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
$needle$,
$replacement$
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
          -- cross-attempt exact and similarity suppression in v6 ranker
          case
            when eligible.selection_lane = 'DASHBOARD_FOUNDATION_GAP' then 0
            when eligible.v6_prior_exact_seen_count = 0 then 0
            when eligible.v6_prior_exact_seen_at
              > coalesce(p_as_of, now()) - interval '180 days' then 2
            else 1
          end,
          case
            when eligible.selection_lane = 'DASHBOARD_FOUNDATION_GAP' then 0
            when eligible.v6_prior_similarity_seen_count = 0 then 0
            when eligible.v6_prior_similarity_seen_at
              > coalesce(p_as_of, now()) - interval '180 days' then 2
            else 1
          end,
          -- long-run dimension max-share brake
          case
            when eligible.selection_lane = 'DASHBOARD_FOUNDATION_GAP' then 0
            when eligible.v6_long_run_answered < 40 then 0
            when eligible.dimension_key is null then 0
            when eligible.v6_long_run_dimension_share
              > greatest(
                  coalesce(eligible.v6_target_share, 0.0) + 0.06,
                  coalesce(eligible.v6_target_share, 0.0) * 1.35
                )
              then 1
            else 0
          end,
          -- long-run section max-share brake
          case
            when eligible.selection_lane = 'DASHBOARD_FOUNDATION_GAP' then 0
            when eligible.v6_long_run_answered < 40 then 0
            when eligible.candidate_section_key is null then 0
            when eligible.v6_long_run_section_share
              > greatest(
                  coalesce(eligible.v6_section_target_share, 0.0) + 0.08,
                  coalesce(eligible.v6_section_target_share, 0.0) * 1.25
                )
              then 1
            else 0
          end,
          -- broad high-specificity demotion in v6 ranker
          case
            when eligible.selection_lane = 'DASHBOARD_FOUNDATION_GAP' then 0
            when public.obs_is_high_specificity_assessment_question(
              eligible.prompt,
              eligible.question_type,
              eligible.payload
            ) then 1
            else 0
          end,
          case
$replacement$
    );
  end if;

  if v_sql = v_original
     or v_sql not like '%cross-attempt exact and similarity suppression in v6 ranker%'
     or v_sql not like '%long-run dimension max-share brake%'
     or v_sql not like '%long-run section max-share brake%'
     or v_sql not like '%broad high-specificity demotion in v6 ranker%' then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 20 patch did not match the expected ranker body.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.obs_rank_ot_assessment_candidates_v6(uuid, uuid, text, integer, timestamptz, integer) is
  'Mode-aware wrapper over v5 with cross-attempt exact/similarity suppression, long-run dimension and section soft brakes, broad high-specificity demotion, dashboard foundation-gap priority, and campaign promotion subject to per-attempt caps. STABLE: writes nothing.';

notify pgrst, 'reload schema';

commit;
