-- The distractor audit is for single-answer MCQs. Sequence items use semantic
-- choice IDs and a correct order, so treating their first ordered choice as a
-- single correct answer creates a false answer-length warning.

begin;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260729_distractor_audit_mcq_scope_fix',
  'public',
  'obs_question_distractor_quality_audit',
  'view',
  pg_get_viewdef(
    'public.obs_question_distractor_quality_audit'::regclass,
    true
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_distractor_audit_mcq_scope_fix'
    and backup.object_schema = 'public'
    and backup.object_name =
          'obs_question_distractor_quality_audit'
    and backup.object_type = 'view'
);

do $$
declare
  base_definition text;
begin
  select regexp_replace(
    pg_get_viewdef(
      'public.obs_question_distractor_quality_audit'::regclass,
      true
    ),
    ';\s*$',
    ''
  )
  into base_definition;

  if base_definition is null then
    raise exception using
      errcode = 'P0001',
      message = 'Could not read the distractor audit view definition.';
  end if;

  execute format(
    'create or replace view public.obs_question_distractor_quality_audit
       with (security_invoker = true)
     as
     select *
     from (%s) audit_scope
     where audit_scope.correct_choice_id in (''A'', ''B'', ''C'', ''D'')',
    base_definition
  );
end
$$;

revoke all on table public.obs_question_distractor_quality_audit
  from public, anon, authenticated;
grant select on table public.obs_question_distractor_quality_audit
  to service_role;

do $$
declare
  audited_mcqs integer;
  remaining_queue integer;
  sequence_rows integer;
begin
  select
    count(*),
    count(*) filter (where requires_review)
  into audited_mcqs, remaining_queue
  from public.obs_question_distractor_quality_audit;

  select count(*)
  into sequence_rows
  from public.obs_question_distractor_quality_audit
  where generated_question_id =
    '4d9d2e13-a3f3-4b84-b1d9-574b7e28158d'::uuid;

  if audited_mcqs <> 1215
     or remaining_queue <> 50
     or sequence_rows <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'MCQ audit scope verification failed: audited=%s queue=%s sequence=%s.',
        audited_mcqs,
        remaining_queue,
        sequence_rows
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
