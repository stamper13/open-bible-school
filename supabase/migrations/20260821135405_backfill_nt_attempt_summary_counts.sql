-- Backfill stale NT assessment attempt summary counters from answer rows.
--
-- This repairs existing NT attempts affected before
-- 20260821134530_sync_nt_attempt_summary_on_submit. It only updates attempts
-- with real answer evidence; rows without answer rows are left untouched.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

with nt_answer_totals as (
  select
    attempt.id as attempt_id,
    count(*) filter (where answer.answered_at is not null)::integer
      as answered_count,
    count(*) filter (
      where answer.answered_at is not null
        and coalesce(answer.is_correct, false)
    )::integer as correct_count
  from public.assessment_attempts attempt
  join public.assessment_answers answer
    on answer.attempt_id = attempt.id
   and answer.user_id = attempt.user_id
  where upper(coalesce(attempt.testament, '')) = 'NT'
  group by attempt.id
  having count(*) filter (where answer.answered_at is not null) > 0
)
update public.assessment_attempts attempt
set
  answered_count = totals.answered_count,
  correct_count = totals.correct_count,
  is_complete =
    totals.answered_count >= greatest(
      1,
      coalesce(
        attempt.target_question_count,
        attempt.question_target,
        attempt.total_count,
        20
      )
    ),
  completed_at = case
    when totals.answered_count >= greatest(
      1,
      coalesce(
        attempt.target_question_count,
        attempt.question_target,
        attempt.total_count,
        20
      )
    )
      then coalesce(attempt.completed_at, now())
    else attempt.completed_at
  end
from nt_answer_totals totals
where attempt.id = totals.attempt_id
  and (
    attempt.answered_count is distinct from totals.answered_count
    or attempt.correct_count is distinct from totals.correct_count
    or coalesce(attempt.is_complete, false) is distinct from (
      totals.answered_count >= greatest(
        1,
        coalesce(
          attempt.target_question_count,
          attempt.question_target,
          attempt.total_count,
          20
        )
      )
    )
  );

commit;
