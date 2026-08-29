begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  v_sql text;
begin
  select backup.definition
  into v_sql
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260826172000_router_v7_supplemental_floor_and_attempt_cap'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_rank_ot_assessment_candidates_v7'
    and backup.object_type = 'function'
  order by backup.created_at desc
  limit 1;

  if v_sql is null then
    raise exception using
      errcode = 'P0001',
      message = 'Missing backup for 20260826172000_router_v7_supplemental_floor_and_attempt_cap rollback.';
  end if;

  execute v_sql;
end
$$;

commit;
