begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  v_sync text;
begin
  select pg_get_functiondef('public.obs_router_sync_campaign(uuid,uuid)'::regprocedure)
  into v_sync;

  if v_sync not like '%unit campaigns count same-book widened-scope spend%'
     or v_sync not like '%question.book_code = v_campaign.book_code%' then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: campaign sync is missing same-book widened-scope spend accounting.';
  end if;

  if not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag = '20260823171000_router_v6_21_count_widened_campaign_spend'
      and backup.object_name = 'obs_router_sync_campaign'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: v6 step 21 did not capture a rollback definition.';
  end if;
end
$$;

rollback;
