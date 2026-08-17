-- Older malformed-question skips used legacy non-scoring exclusion reasons.
-- Keep the malformed review queue focused on whether the learner was protected,
-- not on the exact historical reason string.

create or replace view public.obs_admin_malformed_question_reports as
select
  report.id as report_id,
  report.created_at,
  report.status,
  report.generated_question_id,
  report.attempt_id,
  report.user_id,
  question.question_type,
  coalesce(report.question_prompt, question.payload->>'prompt', question.payload->>'question_text') as prompt,
  substring(report.feedback_text from 'Error code: ([^\n]+)') as error_code,
  substring(report.feedback_text from 'Error message: ([^\n]+)') as error_message,
  question.payload->>'quarantine_reason' as quarantine_reason,
  case when question.question_type like 'quarantined%' then true else false end as is_quarantined,
  exists (
    select 1
    from public.assessment_answers answer
    where answer.attempt_id = report.attempt_id
      and (
        answer.question_id = report.generated_question_id
        or answer.generated_question_id = report.generated_question_id
      )
      and answer.scoring_eligible is false
  ) as recorded_as_non_scoring_skip,
  report.feedback_text,
  question.payload
from public.question_reports report
join public.ot_generated_questions question
  on question.id = report.generated_question_id
where report.report_category = 'malformed_question'
   or report.feedback_text ilike 'Auto-skipped broken assessment question.%'
   or report.feedback_text ilike 'Answer submission failed without advancing the assessment.%';

revoke all on table public.obs_admin_malformed_question_reports
  from public, anon, authenticated;

grant select on table public.obs_admin_malformed_question_reports
  to service_role;

comment on view public.obs_admin_malformed_question_reports is
  'Service-role queue of assessment questions that failed delivery/submission and should be fixed or deleted. Contains user and answer diagnostics and must remain private.';

notify pgrst, 'reload schema';
