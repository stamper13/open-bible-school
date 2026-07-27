-- Restore the original focused-retest foundation band.

begin;

do $$
declare
  backup_definition text;
begin
  select backup.definition
  into backup_definition
  from public.obs_schema_backups backup
  where backup.backup_tag =
      '20260726_focused_foundation_band_refinement'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_focused_item_stage'
    and backup.object_type = 'function'
  order by backup.id desc
  limit 1;

  if backup_definition is null then
    raise exception using
      errcode = 'P0001',
      message = 'Focused foundation refinement rollback aborted: backup not found.';
  end if;

  execute backup_definition;
end
$$;

notify pgrst, 'reload schema';

commit;
