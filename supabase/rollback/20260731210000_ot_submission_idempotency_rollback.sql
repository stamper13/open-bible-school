begin;

do $$
declare
  v_definition text;
begin
  select backup.definition
  into v_definition
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260731_ot_submission_idempotency'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_submit_ot_assessment_response_v2'
    and backup.object_type = 'function'
  order by backup.created_at desc
  limit 1;

  if v_definition is null then
    raise exception using
      errcode = 'P0001',
      message = 'Rollback aborted: OT submission backup is missing';
  end if;

  execute v_definition;
end;
$$;

revoke all on function public.obs_submit_ot_assessment_response_v2(
  uuid, uuid, text, text, jsonb
) from public, anon;
grant execute on function public.obs_submit_ot_assessment_response_v2(
  uuid, uuid, text, text, jsonb
) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
