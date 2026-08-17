do $$
declare
  repaired_count integer;
  repaired_rows_still_flagged integer;
  total_review_queue integer;
begin
  select count(*)
  into repaired_count
  from public.ot_generated_questions
  where payload->>'distractor_review'
    = 'same_category_length_balanced';

  select count(*)
  into repaired_rows_still_flagged
  from public.obs_question_distractor_quality_audit audit
  join public.ot_generated_questions question
    on question.id = audit.generated_question_id
  where question.payload->>'distractor_review'
      = 'same_category_length_balanced'
    and (
      audit.correct_answer_long_flag
      or audit.correct_answer_short_flag
    );

  select count(*)
  into total_review_queue
  from public.obs_question_distractor_quality_audit
  where requires_review;

  if repaired_count <> 10
     or repaired_rows_still_flagged <> 0
     or total_review_queue <> 51
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Distractor repair verification failed: repaired=%s repaired_flagged=%s queue=%s.',
        repaired_count,
        repaired_rows_still_flagged,
        total_review_queue
      );
  end if;
end
$$;

select
  count(*) as audited_mcqs,
  count(*) filter (where requires_review) as remaining_review_queue,
  count(*) filter (where correct_answer_long_flag)
    as correct_answer_too_long,
  count(*) filter (where correct_answer_short_flag)
    as correct_answer_too_short
from public.obs_question_distractor_quality_audit;
