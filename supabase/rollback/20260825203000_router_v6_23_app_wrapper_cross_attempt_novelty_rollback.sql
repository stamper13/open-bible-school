begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  v_definition text;
begin
  select backup.definition
  into v_definition
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260825203000_router_v6_23_app_wrapper_cross_attempt_novelty'
    and backup.object_name = 'get_next_assessment_question'
  order by backup.created_at desc
  limit 1;

  if v_definition is null then
    raise exception using
      errcode = 'P0001',
      message = 'Rollback backup for get_next_assessment_question was not found.';
  end if;

  execute v_definition;
end
$$;

notify pgrst, 'reload schema';

commit;
