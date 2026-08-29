-- Router v6, step 16: one-time cleanup for stale sufficient campaigns.
--
-- Step 15 prevents stale campaigns from surviving normal question sync. This
-- data cleanup closes any already-open unit campaigns whose ladder target is
-- now sufficient.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.obs_router_campaign
  drop constraint if exists obs_router_campaign_closed_reason_check;

alter table public.obs_router_campaign
  add constraint obs_router_campaign_closed_reason_check
  check (
    closed_reason is null
    or closed_reason in (
      'bracketed',
      'budget_spent',
      'bank_exhausted',
      'resolved_strong',
      'superseded_by_reread',
      'stale_abandoned',
      'resolved_ladder_sufficient'
    )
  );

do $migration$
declare
  v_campaign record;
  v_closed integer := 0;
begin
  for v_campaign in
    select campaign.id, campaign.user_id, campaign.unit_key
    from public.obs_router_campaign campaign
    where campaign.closed_at is null
      and campaign.unit_key is not null
  loop
    perform set_config('request.jwt.claim.sub', v_campaign.user_id::text, true);

    if exists (
      select 1
      from public.obs_get_ladder_state_v1(v_campaign.user_id) ladder
      where ladder.unit_key = v_campaign.unit_key
        and ladder.state <> 'insufficient_evidence'
        and ladder.answered >= ladder.required_answers
        and ladder.display_score >= ladder.required_score
    ) then
      update public.obs_router_campaign
      set phase = 'closed',
          closed_at = now(),
          closed_reason = 'resolved_ladder_sufficient',
          last_advanced_at = now(),
          metadata = coalesce(metadata, '{}'::jsonb)
            || jsonb_build_object('cleanup_migration', '20260823152100')
      where id = v_campaign.id
        and closed_at is null;

      v_closed := v_closed + 1;
    end if;
  end loop;

  raise notice 'Closed % stale ladder-sufficient router campaigns.', v_closed;
end
$migration$;

commit;
