begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  v_stale_count integer;
  v_closed_reason_constraint text;
begin
  select pg_get_constraintdef(oid)
  into v_closed_reason_constraint
  from pg_constraint
  where conrelid = 'public.obs_router_campaign'::regclass
    and conname = 'obs_router_campaign_closed_reason_check';

  if v_closed_reason_constraint not like '%resolved_ladder_sufficient%' then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: campaign closed_reason constraint does not allow resolved_ladder_sufficient.';
  end if;

  select count(*)::integer
  into v_stale_count
  from public.obs_router_campaign campaign
  where campaign.closed_at is null
    and campaign.unit_key is not null
    and exists (
      select 1
      from public.obs_get_ladder_state_v1(campaign.user_id) ladder
      where ladder.unit_key = campaign.unit_key
        and ladder.state <> 'insufficient_evidence'
        and ladder.answered >= ladder.required_answers
        and ladder.display_score >= ladder.required_score
    );

  if v_stale_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'FAIL: % ladder-sufficient campaigns are still open.',
        v_stale_count
      );
  end if;
end
$$;

rollback;
