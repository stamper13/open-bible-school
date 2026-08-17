-- Restore the three functions replaced by the NT profile scope migration.

begin;

do $$
declare
  backup record;
  restored integer := 0;
begin
  for backup in
    select definition
    from public.obs_schema_backups
    where backup_tag = '20260729_nt_profile_sections_and_scopes'
      and object_schema = 'public'
      and object_type = 'function'
      and object_name in (
        'obs_nt_scope_key',
        'obs_nt_question_matches_scope',
        'obs_get_scope_summary'
      )
    order by object_name
  loop
    execute backup.definition;
    restored := restored + 1;
  end loop;

  if restored <> 3 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'NT profile scope rollback restored %s/3 functions.',
        restored
      );
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
