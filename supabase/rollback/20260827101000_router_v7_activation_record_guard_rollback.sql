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
  where backup.backup_tag = '20260827101000_router_v7_activation_record_guard'
    and backup.object_schema = 'public'
    and backup.object_name = 'get_next_assessment_question'
    and backup.object_type = 'function'
  order by backup.created_at desc
  limit 1;

  if v_sql is null then
    raise exception using
      errcode = 'P0001',
      message = 'Missing backup for 20260827101000_router_v7_activation_record_guard rollback.';
  end if;

  execute v_sql;
end
$$;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question. V7 activation record-guard rollback restored the previous selector body.';

revoke all on function public.get_next_assessment_question(uuid, uuid) from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
