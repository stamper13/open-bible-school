do $$
declare
  v_definition text;
begin
  select backup.definition
  into v_definition
  from public.obs_schema_backups backup
  where backup.backup_tag
    = '20260730_anonymous_progress_transfer_hardening'
    and backup.object_schema = 'public'
    and backup.object_name = 'migrate_anonymous_data'
    and backup.object_type = 'function'
  order by backup.created_at desc
  limit 1;

  if v_definition is null then
    raise exception using
      errcode = 'P0001',
      message = 'Rollback aborted: backup definition is missing';
  end if;

  execute v_definition;
end;
$$;
