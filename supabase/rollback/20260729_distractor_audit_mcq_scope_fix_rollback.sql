begin;

do $$
declare
  prior_definition text;
begin
  select definition
  into prior_definition
  from public.obs_schema_backups
  where backup_tag = '20260729_distractor_audit_mcq_scope_fix'
    and object_schema = 'public'
    and object_name = 'obs_question_distractor_quality_audit'
    and object_type = 'view'
  order by created_at desc
  limit 1;

  if prior_definition is null then
    raise exception using
      errcode = 'P0001',
      message = 'Distractor audit view backup is missing.';
  end if;

  execute format(
    'create or replace view public.obs_question_distractor_quality_audit
       with (security_invoker = true)
     as %s',
    prior_definition
  );
end
$$;

revoke all on table public.obs_question_distractor_quality_audit
  from public, anon, authenticated;
grant select on table public.obs_question_distractor_quality_audit
  to service_role;

notify pgrst, 'reload schema';

commit;
