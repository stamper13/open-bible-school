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
  where backup.backup_tag = '20260825211000_router_foundation_gap_cached_unit_stage'
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

do $$
declare
  v_definition text;
begin
  select backup.definition
  into v_definition
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260825211000_router_foundation_gap_cached_unit_stage'
    and backup.object_name = 'obs_refresh_router_candidate_facts'
  order by backup.created_at desc
  limit 1;

  if v_definition is null then
    raise exception using
      errcode = 'P0001',
      message = 'Rollback backup for obs_refresh_router_candidate_facts was not found.';
  end if;

  execute v_definition;
end
$$;

drop index if exists public.obs_router_candidate_facts_unit_stage_idx;

alter table if exists public.obs_router_candidate_facts
  drop column if exists unit_key;

do $$
begin
  if to_regprocedure('public.obs_refresh_router_candidate_facts()') is not null then
    perform public.obs_refresh_router_candidate_facts();
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
