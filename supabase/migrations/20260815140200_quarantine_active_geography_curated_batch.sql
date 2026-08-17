-- Quarantine the remaining malformed geography_curated batch.
--
-- These generated questions are missing canonical metadata expected by the
-- answer/scoring path and produced repeated submit timeouts.

begin;

update public.ot_generated_questions question
set question_type = case
    when question.question_type like 'quarantined%' then question.question_type
    else 'quarantined_' || question.question_type
  end,
  payload = jsonb_set(
    question.payload,
    '{quarantine_reason}',
    to_jsonb('Malformed geography_curated batch: missing book_code/dimension metadata and caused submit timeouts.'::text)
  )
where question.question_type = 'geography_curated_mcq_v1';

do $$
declare
  v_active integer;
begin
  select count(*)
  into v_active
  from public.ot_generated_questions
  where question_type = 'geography_curated_mcq_v1';

  if v_active <> 0 then
    raise exception 'Expected no active geography_curated_mcq_v1 rows, found %', v_active;
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
