-- Remove the first Gospel/Acts geography and event batch.
-- Refuse once any replacement question has answer history.

begin;

do $$
declare
  batch_count integer;
  batch_answers integer;
begin
  select count(*)
  into batch_count
  from public.ot_generated_questions question
  where question.payload->>'source_batch' =
          '20260729_nt_gospels_acts_geography_events_batch_1';

  select count(*)
  into batch_answers
  from public.assessment_answers answer
  join public.ot_generated_questions question
    on question.id = answer.generated_question_id
  where question.payload->>'source_batch' =
          '20260729_nt_gospels_acts_geography_events_batch_1';

  if batch_count <> 30 or batch_answers <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT narrative rollback refused: batch=%s/30 answers=%s/0.',
        batch_count,
        batch_answers
      );
  end if;
end
$$;

delete from public.ot_generated_questions
where payload->>'source_batch' =
        '20260729_nt_gospels_acts_geography_events_batch_1';

notify pgrst, 'reload schema';

commit;
