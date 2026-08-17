begin;

do $$
declare
  v_definition text;
begin
  select backup.definition
  into v_definition
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260731_nt_submission_idempotency'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_submit_nt_assessment_answer'
    and backup.object_type = 'function'
  order by backup.created_at desc
  limit 1;

  if v_definition is null then
    raise exception using
      errcode = 'P0001',
      message = 'Rollback aborted: NT submission backup is missing';
  end if;

  execute v_definition;
end;
$$;

revoke all on function public.obs_submit_nt_assessment_answer(
  uuid, uuid, text
) from public, anon;
grant execute on function public.obs_submit_nt_assessment_answer(
  uuid, uuid, text
) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
