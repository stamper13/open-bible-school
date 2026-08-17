begin;

do $$
declare
  saved_definition text;
begin
  select definition
  into saved_definition
  from public.obs_schema_backups
  where backup_tag =
          '20260729_ot_router_v4_directional_downshift_fix'
    and object_schema = 'public'
    and object_name = 'obs_general_route_priority_v4'
    and object_type = 'function'
  order by created_at desc
  limit 1;

  if saved_definition is null then
    raise exception using
      errcode = 'P0001',
      message =
        'OT router directional-downshift rollback definition is missing.';
  end if;

  execute saved_definition;
end
$$;

notify pgrst, 'reload schema';

commit;
