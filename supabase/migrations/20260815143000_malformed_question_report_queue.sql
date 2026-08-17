-- Make malformed assessment delivery/submission failures first-class review
-- items instead of burying them under the generic "other" report category.

alter table public.question_reports
  drop constraint if exists question_reports_category_ck;

alter table public.question_reports
  add constraint question_reports_category_ck
  check (
    report_category = any (
      array[
        'wrong_answer'::text,
        'inaccurate'::text,
        'poorly_worded'::text,
        'other'::text,
        'malformed_question'::text
      ]
    )
  );

update public.question_reports
set report_category = 'malformed_question'
where feedback_text ilike 'Auto-skipped broken assessment question.%'
   or feedback_text ilike 'Answer submission failed without advancing the assessment.%';

do $$
declare
  v_function_definition text;
begin
  select pg_get_functiondef(
    'public.obs_skip_broken_assessment_question(uuid,uuid,text,text,jsonb)'::regprocedure
  )
  into v_function_definition;

  if v_function_definition is null then
    raise exception 'obs_skip_broken_assessment_question function is missing';
  end if;

  execute replace(
    v_function_definition,
    E'\n      ''other'',\n      left(concat_ws',
    E'\n      ''malformed_question'',\n      left(concat_ws'
  );
end $$;

comment on function public.obs_skip_broken_assessment_question(
  uuid, uuid, text, text, jsonb
) is
  'Logs a malformed assessment question, auto-quarantines it, marks it skipped without scoring using schema-valid choice ids, and keeps the attempt target stable.';

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
      and answer.question_id = report.generated_question_id
      and answer.scoring_eligible is false
      and answer.scoring_exclusion_reason = 'auto_skipped_broken_question'
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
