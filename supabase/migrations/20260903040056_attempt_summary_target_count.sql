-- Include the attempt's own target in result summaries.
--
-- The frontend must distinguish a 25-question baseline from a 15-question
-- follow-up update. `completed_at` is only max(answered_at), so the attempt's
-- target is the reliable completion gate.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.obs_get_attempt_summary(
  p_user_id uuid,
  p_attempt_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with authorized_attempt as (
    select
      attempt.id,
      attempt.user_id,
      upper(coalesce(attempt.testament, 'OT')) as testament,
      greatest(
        1,
        coalesce(attempt.target_question_count, attempt.question_target, attempt.total_count, 25)
      )::integer as target_question_count
    from public.assessment_attempts attempt
    where attempt.id = p_attempt_id
      and attempt.user_id = p_user_id
      and public.obs_is_authorized_user(p_user_id)
  ),
  answers as (
    select evidence.*
    from public.obs_answer_evidence evidence
    join authorized_attempt attempt
      on attempt.id = evidence.attempt_id
  ),
  scope_breakdown as (
    select
      'section'::text as breakdown_type,
      section as breakdown_key,
      count(*)::integer as answered,
      count(*) filter (where is_correct)::integer as correct,
      count(*) filter (where is_idk)::integer as idk
    from answers
    group by section
    union all
    select
      'book',
      book_code,
      count(*)::integer,
      count(*) filter (where is_correct)::integer,
      count(*) filter (where is_idk)::integer
    from answers
    group by book_code
    union all
    select
      'dimension',
      dimension_key,
      count(*)::integer,
      count(*) filter (where is_correct)::integer,
      count(*) filter (where is_idk)::integer
    from answers
    group by dimension_key
  ),
  breakdown as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', breakdown_type,
          'key', breakdown_key,
          'answered', answered,
          'correct', correct,
          'idk', idk,
          'accuracy', round(correct::numeric / nullif(answered, 0) * 100, 1)
        )
        order by breakdown_type, breakdown_key
      ),
      '[]'::jsonb
    ) as value
    from scope_breakdown
  ),
  totals as (
    select
      count(*)::integer as answered,
      count(*) filter (where is_correct)::integer as correct,
      count(*) filter (where is_idk)::integer as idk,
      min(answered_at) as started_at,
      max(answered_at) as completed_at
    from answers
  )
  select case
    when not exists (select 1 from authorized_attempt) then null
    else jsonb_build_object(
      'attempt_id', p_attempt_id,
      'testament', (select testament from authorized_attempt limit 1),
      'target_question_count', (select target_question_count from authorized_attempt limit 1),
      'answered', totals.answered,
      'correct', totals.correct,
      'idk', totals.idk,
      'accuracy', round(totals.correct::numeric / nullif(totals.answered, 0) * 100, 1),
      'started_at', totals.started_at,
      'completed_at', totals.completed_at,
      'snapshot', (
        select to_jsonb(snapshot) - 'id' - 'user_id'
        from public.obs_assessment_snapshots snapshot
        where snapshot.attempt_id = p_attempt_id
        order by snapshot.captured_at desc
        limit 1
      ),
      'breakdown', breakdown.value
    )
  end
  from totals
  cross join breakdown;
$$;

revoke all on function public.obs_get_attempt_summary(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.obs_get_attempt_summary(uuid, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
