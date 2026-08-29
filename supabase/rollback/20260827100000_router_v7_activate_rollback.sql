begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  v_sql text;
begin
  update public.obs_router_policy_config
  set active_version = 'V6',
      updated_at = now()
  where policy_key = 'OT_GENERAL';

  select backup.definition
  into v_sql
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260827100000_router_v7_activate'
    and backup.object_schema = 'public'
    and backup.object_name = 'get_next_assessment_question'
    and backup.object_type = 'function'
  order by backup.created_at desc
  limit 1;

  if v_sql is null then
    raise exception using
      errcode = 'P0001',
      message = 'Missing backup for 20260827100000_router_v7_activate rollback.';
  end if;

  execute v_sql;
end
$$;

alter table public.obs_router_policy_config
  drop constraint if exists obs_router_policy_version_ck;

alter table public.obs_router_policy_config
  add constraint obs_router_policy_version_ck
  check (
    active_version in ('V3', 'V4', 'V5', 'V6')
    and shadow_version in ('V3', 'V4', 'V5')
    and active_version <> shadow_version
  );

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question. V7 activation rollback restored the pre-activation selector body.';

revoke all on function public.get_next_assessment_question(uuid, uuid) from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
