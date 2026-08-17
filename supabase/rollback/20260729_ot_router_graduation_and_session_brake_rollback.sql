begin;

do $$
declare
  restored integer := 0;
  backup_definition text;
begin
  select definition
  into backup_definition
  from public.obs_schema_backups
  where backup_tag =
          '20260729_ot_router_graduation_and_session_brake'
    and object_schema = 'public'
    and object_name = 'obs_rank_ot_assessment_candidates_v4'
    and object_type = 'function'
  order by created_at desc, id desc
  limit 1;

  if backup_definition is null then
    raise exception using
      errcode = 'P0001',
      message =
        'Router graduation rollback failed: backup definition is missing.';
  end if;

  execute backup_definition;
  restored := restored + 1;

  if restored <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Router graduation rollback restored %s functions; expected 1.',
        restored
      );
  end if;
end
$$;

drop function if exists public.obs_router_session_brake_stage(
  integer,
  integer,
  integer,
  integer
);

commit;
