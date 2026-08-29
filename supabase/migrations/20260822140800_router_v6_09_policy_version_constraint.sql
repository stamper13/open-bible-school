-- Router v6, step 9: allow V6 in the router policy version constraint.
--
-- Step 6 added the V6-capable router body but one branch still had the older
-- obs_router_policy_version_ck constraint, which allowed V3/V4/V5 only. This
-- follow-up is safe to run after step 6 has already been recorded.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regclass('public.obs_router_policy_config') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 9 prerequisites are missing; nothing was changed.';
  end if;
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

commit;
