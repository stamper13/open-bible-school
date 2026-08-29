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
  where backup.backup_tag = '20260824202000_router_question_facts_perf_cache'
    and backup.object_name = 'obs_router_scope_baseline_met'
  order by backup.created_at desc
  limit 1;

  if v_definition is null then
    raise exception using
      errcode = 'P0001',
      message = 'Rollback backup for obs_router_scope_baseline_met was not found.';
  end if;

  execute v_definition;
end
$$;

drop function if exists public.obs_refresh_router_question_facts();
drop table if exists public.obs_router_question_facts;

notify pgrst, 'reload schema';

commit;
