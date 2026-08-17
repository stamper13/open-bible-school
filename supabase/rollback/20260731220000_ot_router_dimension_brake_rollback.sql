begin;

do $$
declare
  v_definition text;
begin
  select backup.definition
  into v_definition
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260731_ot_router_dimension_brake'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_rank_ot_assessment_candidates_v4'
    and backup.object_type = 'function'
  order by backup.created_at desc
  limit 1;

  if v_definition is null then
    raise exception using
      errcode = 'P0001',
      message = 'Rollback aborted: OT router backup is missing';
  end if;

  execute v_definition;
end;
$$;

drop function if exists public.obs_router_dimension_brake_bucket(
  integer, integer
);
drop function if exists public.obs_router_dimension_brake_stage(
  integer, integer, integer
);

notify pgrst, 'reload schema';

commit;
