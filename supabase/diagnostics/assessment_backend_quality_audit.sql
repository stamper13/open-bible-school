-- Read-only assessment backend quality audit.
--
-- Purpose:
--   Give a senior developer one production-safe report for the launch-critical
--   assessment backend concerns: NT bucket balance, question-bank coverage,
--   real attempt/count consistency, scoring signal shape, and hot-path index
--   inventory.
--
-- Safety:
--   This script only reads metadata, audit views, attempts, and answer
--   aggregates. It does not create, update, or delete application data.

\pset pager off
\pset null '[null]'

\echo ''
\echo '=== Assessment Backend Quality Audit: Overall Question Supply ==='
with eligible as (
  select
    audit.testament,
    audit.section_key,
    count(*)::integer as active_questions,
    count(*) filter (where audit.router_eligible)::integer as router_eligible_questions,
    count(*) filter (where audit.stem_family is not null)::integer as explicit_stem_family_rows,
    count(distinct audit.book_code) filter (where audit.router_eligible)::integer
      as books_with_router_questions,
    count(distinct audit.dimension_key) filter (where audit.router_eligible)::integer
      as dimensions_with_router_questions,
    count(distinct audit.prompt_fingerprint) filter (where audit.router_eligible)::integer
      as distinct_router_prompts
  from public.obs_admin_question_bank_audit audit
  group by audit.testament, audit.section_key
)
select
  testament,
  section_key,
  active_questions,
  router_eligible_questions,
  explicit_stem_family_rows,
  books_with_router_questions,
  dimensions_with_router_questions,
  distinct_router_prompts,
  round(
    explicit_stem_family_rows::numeric
      / nullif(active_questions, 0) * 100,
    1
  ) as explicit_stem_family_pct
from eligible
order by testament nulls last, section_key nulls last;

\echo ''
\echo '=== Step 3: NT Gospels/Acts Split Readiness ==='
with nt_questions as (
  select
    case
      when audit.book_code = 'ACT' then 'ACTS'
      when audit.section_key = 'GOSPELS_ACTS' then 'GOSPELS'
      else audit.section_key
    end as proposed_nt_bucket,
    audit.book_code,
    audit.dimension_key,
    audit.router_eligible,
    audit.stem_family,
    audit.prompt_fingerprint
  from public.obs_admin_question_bank_audit audit
  where audit.testament = 'NT'
), bucket_counts as (
  select
    proposed_nt_bucket,
    count(*)::integer as active_questions,
    count(*) filter (where router_eligible)::integer as router_eligible_questions,
    count(distinct book_code) filter (where router_eligible)::integer
      as books_with_router_questions,
    count(distinct dimension_key) filter (where router_eligible)::integer
      as dimensions_with_router_questions,
    count(distinct prompt_fingerprint) filter (where router_eligible)::integer
      as distinct_router_prompts,
    count(*) filter (where stem_family is not null)::integer
      as explicit_stem_family_rows
  from nt_questions
  group by proposed_nt_bucket
)
select
  proposed_nt_bucket,
  active_questions,
  router_eligible_questions,
  books_with_router_questions,
  dimensions_with_router_questions,
  distinct_router_prompts,
  explicit_stem_family_rows,
  case
    when proposed_nt_bucket = 'ACTS' and router_eligible_questions >= 12
      then 'split_ready_supply'
    when proposed_nt_bucket = 'ACTS'
      then 'keep_combined_until_more_supply'
    when proposed_nt_bucket = 'GOSPELS' and router_eligible_questions >= 40
      then 'split_ready_supply'
    else 'review'
  end as split_readiness_signal
from bucket_counts
order by
  case proposed_nt_bucket
    when 'GOSPELS' then 1
    when 'ACTS' then 2
    when 'PAULINE' then 3
    when 'GENERAL' then 4
    when 'APOCALYPSE' then 5
    else 99
  end;

\echo ''
\echo '=== Step 3: NT Book-Level Router Supply ==='
select
  audit.book_code,
  max(book.name) as book_name,
  case
    when audit.book_code = 'ACT' then 'ACTS'
    when audit.section_key = 'GOSPELS_ACTS' then 'GOSPELS'
    else audit.section_key
  end as proposed_nt_bucket,
  count(*)::integer as active_questions,
  count(*) filter (where audit.router_eligible)::integer as router_eligible_questions,
  count(distinct audit.dimension_key) filter (where audit.router_eligible)::integer
    as dimensions_with_router_questions,
  count(distinct audit.prompt_fingerprint) filter (where audit.router_eligible)::integer
    as distinct_router_prompts,
  count(*) filter (where audit.stem_family is null)::integer as missing_stem_family_rows
from public.obs_admin_question_bank_audit audit
left join public.scripture_books book
  on book.book_code = audit.book_code
where audit.testament = 'NT'
group by audit.book_code, proposed_nt_bucket
order by min(book.canon_order), audit.book_code;

\echo ''
\echo '=== Step 3: Recent NT Served Distribution ==='
with served as (
  select
    audit.book_code,
    case
      when audit.book_code = 'ACT' then 'ACTS'
      when audit.section_key = 'GOSPELS_ACTS' then 'GOSPELS'
      else audit.section_key
    end as proposed_nt_bucket,
    answer.is_correct,
    coalesce(answer.is_idk, false) as is_idk
  from public.assessment_answers answer
  join public.obs_admin_question_bank_audit audit
    on audit.generated_question_id = answer.generated_question_id
  where audit.testament = 'NT'
    and answer.answered_at >= now() - interval '90 days'
)
select
  proposed_nt_bucket,
  book_code,
  count(*)::integer as answers_90d,
  round(avg(case when is_correct then 1.0 else 0.0 end) * 100, 1)
    as accuracy_pct_90d,
  round(avg(case when is_idk then 1.0 else 0.0 end) * 100, 1)
    as idk_pct_90d
from served
group by proposed_nt_bucket, book_code
order by proposed_nt_bucket, answers_90d desc, book_code;

\echo ''
\echo '=== Step 4: Coverage Status Summary ==='
select
  testament,
  section_key,
  coverage_status,
  count(*)::integer as coverage_cells,
  sum(target_gap)::integer as total_target_gap,
  sum(router_eligible_questions)::integer as router_eligible_questions,
  sum(blocker_questions)::integer as blocker_questions,
  sum(warning_questions)::integer as warning_questions
from public.obs_admin_coverage_audit
where target_active_questions > 0
group by testament, section_key, coverage_status
order by testament, section_key, coverage_status;

\echo ''
\echo '=== Step 4: Highest-Priority Coverage Gaps ==='
select
  testament,
  section_key,
  book_code,
  book_name,
  dimension_key,
  dimension_name,
  priority,
  coverage_status,
  router_eligible_questions,
  minimum_active_questions,
  target_active_questions,
  target_gap,
  blocker_questions,
  warning_questions,
  distinct_events,
  distinct_prompts,
  distinct_stem_families
from public.obs_admin_coverage_audit
where coverage_status in ('empty', 'below_minimum', 'under_target', 'low_variety')
  and target_active_questions > 0
order by
  case coverage_status
    when 'empty' then 1
    when 'below_minimum' then 2
    when 'under_target' then 3
    when 'low_variety' then 4
    else 9
  end,
  case priority when 'high' then 1 when 'medium' then 2 else 3 end,
  target_gap desc,
  testament,
  section_key,
  book_code,
  dimension_key
limit 40;

\echo ''
\echo '=== Step 5: Router Hot-Path Function Inventory ==='
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  case p.provolatile
    when 'i' then 'immutable'
    when 's' then 'stable'
    when 'v' then 'volatile'
  end as volatility,
  case p.prosecdef when true then 'security_definer' else 'security_invoker' end
    as security_mode,
  array_remove(array[
    case when p.proname like 'obs_get_next_%assessment_question%'
      and p.provolatile <> 'v' then 'next_question_should_be_volatile' end,
    case when p.prosecdef and p.proconfig is null then 'missing_function_config' end
  ]::text[], null) as review_flags
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'obs_get_next_ot_assessment_question',
    'obs_get_next_ot_baseline_question_fast',
    'get_next_assessment_question',
    'obs_get_next_nt_assessment_question',
    'obs_start_or_resume_ot_assessment_v2',
    'obs_start_nt_assessment',
    'obs_submit_ot_assessment_response_v2',
    'obs_submit_nt_assessment_answer',
    'obs_get_bli_scores_v2',
    'obs_compute_bli_internal'
  )
order by function_name, arguments;

\echo ''
\echo '=== Step 5: Router Hot-Path Index Inventory ==='
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'assessment_answers',
    'assessment_attempts',
    'event_questions',
    'generated_questions',
    'ot_generated_questions',
    'user_abilities',
    'obs_question_dimension_overrides',
    'question_reports'
  )
order by tablename, indexname;

\echo ''
\echo '=== Step 5: Router Table Activity Snapshot ==='
select
  relname as table_name,
  n_live_tup as estimated_live_rows,
  seq_scan,
  idx_scan,
  n_tup_ins,
  n_tup_upd,
  n_tup_del,
  last_analyze,
  last_autoanalyze
from pg_stat_user_tables
where schemaname = 'public'
  and relname in (
    'assessment_answers',
    'assessment_attempts',
    'event_questions',
    'generated_questions',
    'ot_generated_questions',
    'user_abilities',
    'obs_question_dimension_overrides',
    'question_reports'
  )
order by relname;

\echo ''
\echo '=== Step 6: Real Attempt Count Consistency ==='
with answer_counts as (
  select
    answer.attempt_id,
    count(*) filter (where answer.answered_at is not null)::integer as actual_answered,
    count(*) filter (
      where answer.answered_at is not null
        and coalesce(answer.is_correct, false)
        and coalesce(answer.scoring_eligible, true)
    )::integer as actual_correct,
    count(*) filter (
      where answer.answered_at is not null
        and coalesce(answer.is_idk, false)
    )::integer as actual_idk,
    count(*) filter (
      where answer.answered_at is not null
        and not coalesce(answer.scoring_eligible, true)
    )::integer as scoring_excluded
  from public.assessment_answers answer
  group by answer.attempt_id
)
select
  coalesce(attempt.testament, 'UNKNOWN') as testament,
  coalesce(attempt.assessment_kind, 'UNKNOWN') as assessment_kind,
  count(*)::integer as attempts,
  count(*) filter (
    where attempt.answered_count is distinct from coalesce(answer_counts.actual_answered, 0)
  )::integer as answered_count_mismatches,
  count(*) filter (
    where attempt.correct_count is distinct from coalesce(answer_counts.actual_correct, 0)
  )::integer as correct_count_mismatches,
  sum(coalesce(answer_counts.actual_answered, 0))::integer as actual_answers,
  sum(coalesce(answer_counts.actual_idk, 0))::integer as actual_idk,
  sum(coalesce(answer_counts.scoring_excluded, 0))::integer as scoring_excluded_answers
from public.assessment_attempts attempt
left join answer_counts
  on answer_counts.attempt_id = attempt.id
where attempt.created_at >= now() - interval '90 days'
group by coalesce(attempt.testament, 'UNKNOWN'), coalesce(attempt.assessment_kind, 'UNKNOWN')
order by testament, assessment_kind;

\echo ''
\echo '=== Step 6: Real Answer Scoring Signal Shape ==='
select
  evidence.testament,
  evidence.section,
  count(*)::integer as scored_answers,
  count(distinct evidence.user_id)::integer as learners,
  count(distinct evidence.generated_question_id)::integer as questions_seen,
  round(avg(case when evidence.is_correct then 1.0 else 0.0 end) * 100, 1)
    as accuracy_pct,
  round(avg(case when evidence.is_idk then 1.0 else 0.0 end) * 100, 1)
    as idk_pct,
  round(avg(evidence.effective_irt_a)::numeric, 2) as avg_irt_a,
  round(avg(evidence.effective_irt_b)::numeric, 1) as avg_irt_b
from public.obs_answer_evidence evidence
where evidence.answered_at >= now() - interval '90 days'
group by evidence.testament, evidence.section
order by evidence.testament, evidence.section;

\echo ''
\echo '=== Step 6: Calibration Items With Enough Evidence ==='
select
  difficulty_status,
  count(*)::integer as questions,
  max(calibration_answer_count)::integer as max_calibration_answers,
  round(avg(abs(residual_percentage_points))::numeric, 1)
    as avg_abs_residual_percentage_points
from public.obs_admin_difficulty_audit
where calibration_answer_count >= 12
group by difficulty_status
order by
  case difficulty_status
    when 'high_mismatch' then 1
    when 'review' then 2
    when 'aligned' then 3
    else 9
  end;
