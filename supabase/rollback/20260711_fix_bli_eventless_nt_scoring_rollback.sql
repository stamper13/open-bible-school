-- Restore the scoring functions captured before
-- 20260711_fix_bli_eventless_nt_scoring.sql was applied.

begin;

do $$
declare
  backup record;
begin
  for backup in
    select distinct on (object_name)
      object_name,
      definition
    from public.obs_schema_backups
    where backup_tag = '20260711_fix_bli_eventless_nt_scoring'
      and object_schema = 'public'
      and object_type = 'function'
      and object_name in ('compute_bli', 'update_theta_internal')
    order by object_name, created_at desc
  loop
    execute backup.definition;
  end loop;

  if not found then
    raise exception 'No function backups found for 20260711_fix_bli_eventless_nt_scoring';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
