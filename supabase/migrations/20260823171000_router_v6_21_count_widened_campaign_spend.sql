-- Router v6, step 21: count same-book widened campaign spend.
--
-- The history-aware 200-question rerun exposed a unit campaign that moved to
-- widen_scope and repeatedly served a Joshua geography item with unit_key null.
-- The ranker correctly treated that as a same-book widened-scope campaign
-- candidate, but obs_router_sync_campaign only counted exact unit_key matches
-- whenever the campaign itself had a unit_key. The campaign therefore failed
-- to advance/close even after spending repeated evidence.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regprocedure('public.obs_router_sync_campaign(uuid,uuid)') is null
     or to_regclass('public.obs_schema_backups') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 21 prerequisites are missing; nothing was changed.';
  end if;
end
$$;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260823171000_router_v6_21_count_widened_campaign_spend',
  'public',
  'obs_router_sync_campaign',
  'function',
  pg_get_functiondef('public.obs_router_sync_campaign(uuid,uuid)'::regprocedure)
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260823171000_router_v6_21_count_widened_campaign_spend'
    and backup.object_name = 'obs_router_sync_campaign'
);

do $migration$
declare
  v_sql text;
  v_original text;
begin
  select pg_get_functiondef('public.obs_router_sync_campaign(uuid,uuid)'::regprocedure)
  into v_sql;

  v_original := v_sql;

  if v_sql like '%unit campaigns count same-book widened-scope spend%' then
    raise notice 'Router v6 widened campaign spend accounting is already installed.';
    return;
  end if;

  v_sql := replace(
    v_sql,
$needle$
      and (
        (v_campaign.unit_key is not null
          and question.unit_key = v_campaign.unit_key)
        or (v_campaign.unit_key is null
          and question.book_code = v_campaign.book_code)
      );
$needle$,
$replacement$
      and (
        -- unit campaigns count same-book widened-scope spend
        (v_campaign.unit_key is not null
          and (
            question.unit_key = v_campaign.unit_key
            or question.book_code = v_campaign.book_code
          ))
        or (v_campaign.unit_key is null
          and question.book_code = v_campaign.book_code)
      );
$replacement$
  );

  if v_sql = v_original
     or v_sql not like '%unit campaigns count same-book widened-scope spend%' then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 21 patch did not match the expected campaign sync body.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.obs_router_sync_campaign(uuid, uuid) is
  'Synchronizes OT router campaigns, including stale campaign closure and same-book widened-scope spend accounting for unit campaigns.';

notify pgrst, 'reload schema';

commit;
