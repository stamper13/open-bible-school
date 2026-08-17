-- Restore the pre-separation legacy BLI aggregate and remove the dashboard
-- testament score RPC.

begin;

do $$
declare
  saved_definition text;
begin
  select backup.definition
  into saved_definition
  from public.obs_schema_backups backup
  where backup.backup_tag =
          '20260729_testament_separated_bli_scores'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_compute_bli_internal'
    and backup.object_type = 'function';

  if saved_definition is null then
    raise exception using
      errcode = 'P0001',
      message =
        'Testament score rollback refused: function backup is missing.';
  end if;

  execute saved_definition;
end
$$;

drop function if exists
  public.obs_get_testament_bli_scores(uuid);

delete from public.obs_schema_backups
where backup_tag = '20260729_testament_separated_bli_scores'
  and object_schema = 'public'
  and object_name = 'obs_compute_bli_internal'
  and object_type = 'function';

notify pgrst, 'reload schema';

commit;
