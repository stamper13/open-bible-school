-- Retroactively quarantine questions that were already auto-skipped before the
-- skip RPC learned to quarantine them immediately.

update public.ot_generated_questions question
set question_type = case
      when question.question_type like 'quarantined%' then question.question_type
      else 'quarantined_' || question.question_type
    end,
    payload = jsonb_set(
      question.payload,
      '{quarantine_reason}',
      to_jsonb('Auto-quarantined from an existing auto-skipped question report.'::text)
    )
where exists (
  select 1
  from public.question_reports report
  where report.generated_question_id = question.id
    and report.feedback_text ilike 'Auto-skipped broken assessment question.%'
);

notify pgrst, 'reload schema';
