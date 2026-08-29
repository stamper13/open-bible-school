-- V7 task 5: shadow-only router candidate ranking and logging.
--
-- This installs an internal V7 ranker over a widened V6 candidate pool plus a
-- locked shadow log table. It intentionally does not alter the app-facing RPC
-- chain or any displayed BLI behavior.

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
     or to_regclass('public.obs_question_ladder_metadata') is null
     or to_regclass('public.assessment_attempts') is null
     or to_regclass('public.assessment_answers') is null
     or to_regclass('public.obs_question_bank_with_dimensions') is null
     or to_regclass('public.obs_biblical_books') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 shadow prerequisites are missing; no changes made.';
  end if;
end
$$;

create table if not exists public.obs_router_v7_shadow_log (
  id bigserial primary key,
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  user_id uuid not null,
  answer_count integer not null default 0,
  live_version text,
  shadow_version text not null default 'V7_SHADOW_20260824',
  live_selected_question_id uuid,
  v7_shadow_question_id uuid not null references public.ot_generated_questions(id) on delete restrict,
  live_book_code text,
  live_section_key text,
  live_dimension_key text,
  v7_book_code text,
  v7_section_key text,
  v7_dimension_key text,
  v7_routing_granularity text,
  v7_scoring_scope_level text,
  v7_depth_stage smallint,
  v7_parent_answered integer,
  v7_parent_gate text,
  v7_campaign_phase text,
  v7_campaign_match text,
  v7_campaign_spend_scope text,
  v7_candidate_rank bigint,
  v7_lane text,
  v7_reason text,
  v7_prior_exact_seen boolean not null default false,
  v7_prior_similarity_seen boolean not null default false,
  v7_attempt_section_share double precision,
  v7_attempt_dimension_share double precision,
  v7_long_run_section_share double precision,
  v7_long_run_dimension_share double precision,
  v7_novelty_flags jsonb not null default '{}'::jsonb,
  v7_share_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.obs_router_v7_shadow_log enable row level security;

revoke all on table public.obs_router_v7_shadow_log from public, anon, authenticated;
revoke all on sequence public.obs_router_v7_shadow_log_id_seq from public, anon, authenticated;
grant all on table public.obs_router_v7_shadow_log to service_role;
grant usage, select on sequence public.obs_router_v7_shadow_log_id_seq to service_role;

create index if not exists obs_router_v7_shadow_log_attempt_idx
  on public.obs_router_v7_shadow_log (attempt_id, created_at desc);

create index if not exists obs_router_v7_shadow_log_user_idx
  on public.obs_router_v7_shadow_log (user_id, created_at desc);

create index if not exists obs_router_v7_shadow_log_v7_scope_idx
  on public.obs_router_v7_shadow_log (
    v7_section_key,
    v7_dimension_key,
    v7_routing_granularity,
    created_at desc
  );

create or replace function public.obs_rank_ot_assessment_candidates_v7(
  p_attempt_id uuid,
  p_user_id uuid,
  p_policy text default 'V7_SHADOW',
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
  campaign_match text,
  v7_routing_granularity text,
  v7_scoring_scope_level text,
  v7_depth_stage smallint,
  v7_global_signal_weight numeric,
  v7_local_signal_weight numeric,
  v7_metadata_confidence numeric,
  v7_review_status text,
  v7_lane text,
  v7_reason text,
  v7_parent_answered integer,
  v7_parent_gate text,
  v7_campaign_spend_scope text,
  v7_prior_exact_seen boolean,
  v7_prior_similarity_seen boolean,
  v7_attempt_section_share double precision,
  v7_attempt_dimension_share double precision,
  v7_long_run_section_share double precision,
  v7_long_run_dimension_share double precision,
  v6_candidate_rank bigint,
  v6_selection_lane text,
  v6_routing_mode text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with attempt_scope as (
    select
      upper(coalesce(attempt.testament, 'OT')) as testament,
      upper(coalesce(attempt.scope_key, 'OT')) as scope_key
    from public.assessment_attempts attempt
    where attempt.id = p_attempt_id
      and attempt.user_id = p_user_id
    limit 1
  ),
  answer_totals as (
    select count(*) filter (where coalesce(answer.scoring_eligible, true))::integer
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
    cross join attempt_scope attempt
    where target.target_active_questions > 0
      and target.dimension_key is not null
      and public.question_matches_assessment_scope(
        target.book_code,
        attempt.testament,
        attempt.scope_key
      )
    group by target.dimension_key
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
  history as (
    select
      answer.attempt_id,
      answer.generated_question_id,
      answer.answered_at,
      coalesce(answer.is_correct, false) as is_correct,
      question.book_code,
      public.canonical_assessment_scope(question.book_code) as section_key,
      question.dimension_key,
      question.question_type,
      question.payload,
      coalesce(question.payload->>'prompt', question.prompt) as prompt,
      metadata.unit_key,
      metadata.routing_granularity,
      metadata.scoring_scope_level,
      metadata.depth_stage,
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
    join public.obs_question_ladder_metadata metadata
      on metadata.generated_question_id = answer.generated_question_id
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
    from history
  ),
  long_run_section_stats as (
    select
      history.section_key,
      count(*)::double precision
        / nullif((select scoring_answered from long_run_totals), 0)
        as observed_share,
      count(*)::integer as answered,
      avg(case when history.is_correct then 1.0 else 0.0 end) as accuracy
    from history
    group by history.section_key
  ),
  long_run_dimension_stats as (
    select
      history.dimension_key,
      count(*)::double precision
        / nullif((select scoring_answered from long_run_totals), 0)
        as observed_share,
      count(*)::integer as answered,
      avg(case when history.is_correct then 1.0 else 0.0 end) as accuracy
    from history
    where history.dimension_key is not null
    group by history.dimension_key
  ),
  attempt_section_stats as (
    select
      history.section_key,
      count(*)::double precision
        / nullif((select scoring_answered from answer_totals), 0)
        as observed_share
    from history
    where history.attempt_id = p_attempt_id
    group by history.section_key
  ),
  attempt_dimension_stats as (
    select
      history.dimension_key,
      count(*)::double precision
        / nullif((select scoring_answered from answer_totals), 0)
        as observed_share
    from history
    where history.attempt_id = p_attempt_id
      and history.dimension_key is not null
    group by history.dimension_key
  ),
  recent_narrow_miss as (
    select distinct on (history.book_code, history.unit_key, history.dimension_key)
      history.book_code,
      history.unit_key,
      history.dimension_key,
      history.section_key,
      history.depth_stage,
      history.answered_at
    from history
    where not history.is_correct
      and history.depth_stage >= 4
    order by history.book_code, history.unit_key, history.dimension_key, history.answered_at desc
  ),
  v6_pool as (
    select *
    from public.obs_rank_ot_assessment_candidates_v6(
      p_attempt_id,
      p_user_id,
      'V6',
      p_answer_limit,
      coalesce(p_as_of, now()),
      200
    )
  ),
  enriched as (
    select
      v6_pool.*,
      metadata.section_key as v7_section_key,
      metadata.unit_key as v7_unit_key,
      metadata.routing_granularity as v7_routing_granularity,
      metadata.scoring_scope_level as v7_scoring_scope_level,
      metadata.depth_stage as v7_depth_stage,
      metadata.global_signal_weight as v7_global_signal_weight,
      metadata.local_signal_weight as v7_local_signal_weight,
      metadata.metadata_confidence as v7_metadata_confidence,
      metadata.review_status as v7_review_status,
      metadata.chapter_addressed_prompt as v7_chapter_addressed_prompt,
      metadata.exact_chapter_recall_required as v7_exact_chapter_recall_required,
      public.obs_assessment_question_similarity_key(
        v6_pool.payload,
        v6_pool.book_code,
        v6_pool.dimension_key,
        v6_pool.question_type,
        coalesce(v6_pool.payload->>'prompt', v6_pool.prompt)
      ) as v7_similarity_key,
      exists (
        select 1
        from history prior
        where prior.attempt_id <> p_attempt_id
          and prior.generated_question_id = v6_pool.generated_question_id
      ) as v7_prior_exact_seen,
      exists (
        select 1
        from history prior
        where prior.attempt_id <> p_attempt_id
          and prior.similarity_key =
            public.obs_assessment_question_similarity_key(
              v6_pool.payload,
              v6_pool.book_code,
              v6_pool.dimension_key,
              v6_pool.question_type,
              coalesce(v6_pool.payload->>'prompt', v6_pool.prompt)
            )
      ) as v7_prior_similarity_seen,
      coalesce(attempt_section_stats.observed_share, 0.0)
        as v7_attempt_section_share,
      coalesce(attempt_dimension_stats.observed_share, 0.0)
        as v7_attempt_dimension_share,
      coalesce(long_run_section_stats.observed_share, 0.0)
        as v7_long_run_section_share,
      coalesce(long_run_dimension_stats.observed_share, 0.0)
        as v7_long_run_dimension_share,
      coalesce(section_targets.target_share, 0.0)
        as v7_section_target_share,
      coalesce(dimension_targets.target_share, 0.0)
        as v7_dimension_target_share,
      coalesce(long_run_section_stats.answered, 0) as v7_section_answered,
      coalesce(long_run_dimension_stats.answered, 0) as v7_dimension_answered,
      coalesce(long_run_section_stats.accuracy, 1.0) as v7_section_accuracy,
      coalesce(long_run_dimension_stats.accuracy, 1.0) as v7_dimension_accuracy,
      coalesce(parent_evidence.parent_answered, 0) as v7_parent_answered,
      recent_narrow_miss.answered_at is not null as v7_has_recent_narrow_miss,
      case
        when metadata.depth_stage < 4 then 'not_narrow'
        when coalesce(parent_evidence.parent_answered, 0) >= 2 then 'parent_evidence_present'
        else 'blocked_no_parent_evidence'
      end as v7_parent_gate,
      case
        when v6_pool.campaign_phase is null
          and v6_pool.campaign_match is null then null
        when metadata.unit_key is not null then concat_ws(
          '|',
          'unit:' || metadata.unit_key,
          'book:' || v6_pool.book_code,
          'dimension:' || coalesce(v6_pool.dimension_key, 'none')
        )
        else concat_ws(
          '|',
          'book:' || v6_pool.book_code,
          'section:' || coalesce(metadata.section_key, public.canonical_assessment_scope(v6_pool.book_code)),
          'dimension:' || coalesce(v6_pool.dimension_key, 'none')
        )
      end as v7_campaign_spend_scope
    from v6_pool
    join public.obs_question_ladder_metadata metadata
      on metadata.generated_question_id = v6_pool.generated_question_id
    left join section_targets
      on section_targets.section_key = metadata.section_key
    left join dimension_targets
      on dimension_targets.dimension_key = v6_pool.dimension_key
    left join attempt_section_stats
      on attempt_section_stats.section_key = metadata.section_key
    left join attempt_dimension_stats
      on attempt_dimension_stats.dimension_key = v6_pool.dimension_key
    left join long_run_section_stats
      on long_run_section_stats.section_key = metadata.section_key
    left join long_run_dimension_stats
      on long_run_dimension_stats.dimension_key = v6_pool.dimension_key
    left join recent_narrow_miss
      on recent_narrow_miss.book_code = v6_pool.book_code
     and recent_narrow_miss.dimension_key is not distinct from v6_pool.dimension_key
     and (
       recent_narrow_miss.unit_key is null
       or metadata.unit_key is null
       or recent_narrow_miss.unit_key = metadata.unit_key
     )
    left join lateral (
      select count(*)::integer as parent_answered
      from history prior
      where prior.generated_question_id <> v6_pool.generated_question_id
        and prior.depth_stage < metadata.depth_stage
        and (
          (
            metadata.depth_stage >= 4
            and metadata.unit_key is not null
            and (
              prior.unit_key = metadata.unit_key
              or (
                prior.book_code = v6_pool.book_code
                and prior.depth_stage <= 2
              )
            )
          )
          or (
            metadata.depth_stage >= 4
            and metadata.unit_key is null
            and prior.book_code = v6_pool.book_code
          )
          or (
            metadata.depth_stage < 4
            and (
              (metadata.unit_key is not null and prior.unit_key = metadata.unit_key)
              or (metadata.unit_key is null and prior.book_code = v6_pool.book_code)
              or (metadata.section_key is not null and prior.section_key = metadata.section_key)
            )
          )
        )
    ) parent_evidence on true
    where v6_pool.payload ? 'choices'
      and v6_pool.payload ? 'correct_choice_id'
      and v6_pool.prompt is not null
      and v6_pool.book_code is not null
      and v6_pool.dimension_key is not null
  ),
  reasoned as (
    select
      enriched.*,
      case
        when enriched.v7_has_recent_narrow_miss
          and enriched.v7_depth_stage <= 3 then 'WIDEN_AFTER_NARROW_MISS'
        when (select scoring_answered from answer_totals) < 8
          and enriched.v7_depth_stage <= 2 then 'BROAD_OPEN'
        when (
            enriched.v7_section_answered >= 3
            and enriched.v7_section_accuracy < 0.55
            and enriched.v7_depth_stage <= 3
          )
          or (
            enriched.v7_dimension_answered >= 3
            and enriched.v7_dimension_accuracy < 0.55
            and enriched.v7_depth_stage <= 3
          ) then 'WEAK_AREA_EVIDENCE'
        when enriched.v7_parent_answered >= 3
          and enriched.v7_depth_stage >= 4 then 'STRESS_TEST'
        else 'BROAD_COVERAGE'
      end as v7_lane,
      concat_ws(
        '; ',
        case when enriched.v7_prior_exact_seen then 'exact repeat suppressed' end,
        case when enriched.v7_prior_similarity_seen then 'similarity repeat suppressed' end,
        case when enriched.v7_has_recent_narrow_miss and enriched.v7_depth_stage <= 3 then 'widening after narrow miss' end,
        case when (select scoring_answered from answer_totals) < 8 then 'thin evidence favors broad candidates' end,
        case when enriched.v7_parent_gate = 'blocked_no_parent_evidence' then 'narrow candidate lacks parent evidence' end,
        case when enriched.v7_campaign_spend_scope is not null then 'campaign spend scope captured' end,
        case when enriched.v7_chapter_addressed_prompt then 'chapter-addressed prompt demoted' end,
        case when enriched.v7_exact_chapter_recall_required then 'exact chapter recall demoted' end,
        case when enriched.v7_review_status in ('needs_review', 'flagged') then 'metadata review status demoted' end,
        case when enriched.v7_long_run_section_share > greatest(enriched.v7_section_target_share + 0.08, enriched.v7_section_target_share * 1.25) then 'section share brake' end,
        case when enriched.v7_long_run_dimension_share > greatest(enriched.v7_dimension_target_share + 0.06, enriched.v7_dimension_target_share * 1.35) then 'dimension share brake' end
      ) as v7_reason
    from enriched
  ),
  ranked as (
    select
      reasoned.*,
      (row_number() over (
        order by
          case
            when reasoned.v7_parent_gate = 'blocked_no_parent_evidence' then 4
            else 0
          end,
          case when reasoned.v7_prior_exact_seen then 3 else 0 end,
          case when reasoned.v7_prior_similarity_seen then 2 else 0 end,
          case when reasoned.v7_review_status = 'flagged' then 3
               when reasoned.v7_review_status = 'needs_review' then 2
               else 0 end,
          case when reasoned.v7_exact_chapter_recall_required then 2 else 0 end,
          case when reasoned.v7_chapter_addressed_prompt then 1 else 0 end,
          case
            when (select scoring_answered from answer_totals) < 8
              and reasoned.v7_depth_stage <= 2 then 0
            when (select scoring_answered from answer_totals) < 8
              and reasoned.v7_depth_stage >= 4 then 2
            else 1
          end,
          case
            when reasoned.v7_has_recent_narrow_miss
              and reasoned.v7_depth_stage <= 3 then 0
            when reasoned.v7_has_recent_narrow_miss
              and reasoned.v7_depth_stage >= 4 then 2
            else 1
          end,
          case
            when reasoned.v7_long_run_section_share
              > greatest(reasoned.v7_section_target_share + 0.08, reasoned.v7_section_target_share * 1.25)
              then 1
            else 0
          end,
          case
            when reasoned.v7_long_run_dimension_share
              > greatest(reasoned.v7_dimension_target_share + 0.06, reasoned.v7_dimension_target_share * 1.35)
              then 1
            else 0
          end,
          -coalesce(reasoned.v7_global_signal_weight, 0),
          -coalesce(reasoned.information_score, 0),
          -coalesce(reasoned.adaptive_score, 0),
          reasoned.route_priority,
          reasoned.candidate_rank
      ))::bigint as v7_rank
    from reasoned
  )
  select
    ranked.v7_rank as candidate_rank,
    ranked.generated_question_id,
    ranked.prompt,
    ranked.question_type,
    ranked.payload,
    ranked.event_title,
    ranked.book_code,
    ranked.section,
    ranked.importance_tier,
    ranked.dimension_key,
    ranked.question_family,
    ranked.candidate_stage,
    ranked.target_stage,
    ranked.target_theta,
    ranked.theta_se,
    ranked.theta_source,
    ranked.route_priority,
    ranked.v7_lane as selection_lane,
    ranked.information_score,
    ranked.information_reliability,
    ranked.calibration_responses,
    ranked.adaptive_score,
    ranked.times_answered,
    'shadow'::text as routing_mode,
    ranked.campaign_phase,
    ranked.campaign_match,
    ranked.v7_routing_granularity,
    ranked.v7_scoring_scope_level,
    ranked.v7_depth_stage,
    ranked.v7_global_signal_weight,
    ranked.v7_local_signal_weight,
    ranked.v7_metadata_confidence,
    ranked.v7_review_status,
    ranked.v7_lane,
    coalesce(nullif(ranked.v7_reason, ''), 'V7 metadata-aware rerank of widened V6 pool') as v7_reason,
    ranked.v7_parent_answered,
    ranked.v7_parent_gate,
    ranked.v7_campaign_spend_scope,
    ranked.v7_prior_exact_seen,
    ranked.v7_prior_similarity_seen,
    ranked.v7_attempt_section_share,
    ranked.v7_attempt_dimension_share,
    ranked.v7_long_run_section_share,
    ranked.v7_long_run_dimension_share,
    ranked.candidate_rank as v6_candidate_rank,
    ranked.selection_lane as v6_selection_lane,
    ranked.routing_mode as v6_routing_mode
  from ranked
  where ranked.v7_rank <= greatest(1, least(coalesce(p_limit, 25), 200))
  order by ranked.v7_rank;
$$;

create or replace function public.obs_log_ot_assessment_v7_shadow_selection(
  p_attempt_id uuid,
  p_user_id uuid,
  p_live_selected_question_id uuid default null,
  p_live_version text default null,
  p_as_of timestamptz default now()
)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_answer_count integer;
  v_shadow record;
  v_live_book_code text;
  v_live_section_key text;
  v_live_dimension_key text;
begin
  select count(*) filter (where coalesce(answer.scoring_eligible, true))::integer
  into v_answer_count
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id
    and answer.user_id = p_user_id
    and answer.answered_at <= coalesce(p_as_of, now());

  select *
  into v_shadow
  from public.obs_rank_ot_assessment_candidates_v7(
    p_attempt_id,
    p_user_id,
    'V7_SHADOW',
    v_answer_count,
    coalesce(p_as_of, now()),
    1
  )
  order by candidate_rank
  limit 1;

  if v_shadow.generated_question_id is null then
    return null;
  end if;

  if p_live_selected_question_id is not null then
    select
      live.book_code,
      book.section_key,
      live.dimension_key
    into v_live_book_code,
         v_live_section_key,
         v_live_dimension_key
    from public.obs_question_bank_with_dimensions live
    left join public.obs_biblical_books book
      on book.book_code = live.book_code
    where live.generated_question_id = p_live_selected_question_id
    limit 1;
  end if;

  insert into public.obs_router_v7_shadow_log (
    attempt_id,
    user_id,
    answer_count,
    live_version,
    shadow_version,
    live_selected_question_id,
    v7_shadow_question_id,
    live_book_code,
    live_section_key,
    live_dimension_key,
    v7_book_code,
    v7_section_key,
    v7_dimension_key,
    v7_routing_granularity,
    v7_scoring_scope_level,
    v7_depth_stage,
    v7_parent_answered,
    v7_parent_gate,
    v7_campaign_phase,
    v7_campaign_match,
    v7_campaign_spend_scope,
    v7_candidate_rank,
    v7_lane,
    v7_reason,
    v7_prior_exact_seen,
    v7_prior_similarity_seen,
    v7_attempt_section_share,
    v7_attempt_dimension_share,
    v7_long_run_section_share,
    v7_long_run_dimension_share,
    v7_novelty_flags,
    v7_share_snapshot
  )
  values (
    p_attempt_id,
    p_user_id,
    coalesce(v_answer_count, 0),
    p_live_version,
    'V7_SHADOW_20260824',
    p_live_selected_question_id,
    v_shadow.generated_question_id,
    v_live_book_code,
    v_live_section_key,
    v_live_dimension_key,
    v_shadow.book_code,
    (select metadata.section_key
     from public.obs_question_ladder_metadata metadata
     where metadata.generated_question_id = v_shadow.generated_question_id),
    v_shadow.dimension_key,
    v_shadow.v7_routing_granularity,
    v_shadow.v7_scoring_scope_level,
    v_shadow.v7_depth_stage,
    v_shadow.v7_parent_answered,
    v_shadow.v7_parent_gate,
    v_shadow.campaign_phase,
    v_shadow.campaign_match,
    v_shadow.v7_campaign_spend_scope,
    v_shadow.candidate_rank,
    v_shadow.v7_lane,
    v_shadow.v7_reason,
    coalesce(v_shadow.v7_prior_exact_seen, false),
    coalesce(v_shadow.v7_prior_similarity_seen, false),
    v_shadow.v7_attempt_section_share,
    v_shadow.v7_attempt_dimension_share,
    v_shadow.v7_long_run_section_share,
    v_shadow.v7_long_run_dimension_share,
    jsonb_build_object(
      'prior_exact_seen', coalesce(v_shadow.v7_prior_exact_seen, false),
      'prior_similarity_seen', coalesce(v_shadow.v7_prior_similarity_seen, false),
      'v6_candidate_rank', v_shadow.v6_candidate_rank,
      'v6_selection_lane', v_shadow.v6_selection_lane,
      'parent_gate', v_shadow.v7_parent_gate
    ),
    jsonb_build_object(
      'attempt_section_share', v_shadow.v7_attempt_section_share,
      'attempt_dimension_share', v_shadow.v7_attempt_dimension_share,
      'long_run_section_share', v_shadow.v7_long_run_section_share,
      'long_run_dimension_share', v_shadow.v7_long_run_dimension_share,
      'campaign_spend_scope', v_shadow.v7_campaign_spend_scope
    )
  );

  return v_shadow.generated_question_id;
end;
$$;

comment on table public.obs_router_v7_shadow_log is
  'Internal shadow-mode log comparing live OT routing with V7 metadata-aware candidate ranking. No direct anon/authenticated access.';

comment on function public.obs_rank_ot_assessment_candidates_v7(uuid, uuid, text, integer, timestamptz, integer) is
  'Shadow-only V7 OT candidate ranker. Reranks a widened V6 pool with ladder metadata, parent-scope evidence, novelty suppression, and section/dimension share brakes. STABLE: writes nothing.';

comment on function public.obs_log_ot_assessment_v7_shadow_selection(uuid, uuid, uuid, text, timestamptz) is
  'Internal service helper that logs the top V7 shadow candidate for an OT attempt without changing the live selected question.';

revoke all on function public.obs_rank_ot_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.obs_rank_ot_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
) to service_role;

revoke all on function public.obs_log_ot_assessment_v7_shadow_selection(
  uuid, uuid, uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.obs_log_ot_assessment_v7_shadow_selection(
  uuid, uuid, uuid, text, timestamptz
) to service_role;

notify pgrst, 'reload schema';

commit;
