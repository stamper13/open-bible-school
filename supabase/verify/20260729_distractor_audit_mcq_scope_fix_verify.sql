do $$
declare
  audited_mcqs integer;
  remaining_queue integer;
  non_letter_answer_keys integer;
begin
  select
    count(*),
    count(*) filter (where requires_review),
    count(*) filter (
      where correct_choice_id not in ('A', 'B', 'C', 'D')
    )
  into audited_mcqs, remaining_queue, non_letter_answer_keys
  from public.obs_question_distractor_quality_audit;

  if audited_mcqs <> 1215
     or remaining_queue <> 50
     or non_letter_answer_keys <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'MCQ audit verification failed: audited=%s queue=%s non_letter=%s.',
        audited_mcqs,
        remaining_queue,
        non_letter_answer_keys
      );
  end if;
end
$$;

select
  count(*) as audited_mcqs,
  count(*) filter (where requires_review) as review_queue
from public.obs_question_distractor_quality_audit;
