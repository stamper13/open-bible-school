-- Restore the exact pre-step-21 campaign sync body captured by the forward
-- migration.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback$
declare
  v_sql text;
begin
  select backup.definition
  into v_sql
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260823171000_router_v6_21_count_widened_campaign_spend'
    and backup.object_name = 'obs_router_sync_campaign'
  order by backup.created_at desc
  limit 1;

  if v_sql is null then
    raise exception using
      errcode = 'P0001',
      message = 'Missing backup for router v6 step 21 rollback.';
  end if;

  execute v_sql;
end
$rollback$;

comment on function public.obs_router_sync_campaign(uuid, uuid) is
  'Synchronizes OT router campaigns, including stale campaign closure when the target unit is already sufficient on the ladder.';

notify pgrst, 'reload schema';

commit;
