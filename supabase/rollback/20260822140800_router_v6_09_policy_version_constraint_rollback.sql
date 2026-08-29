\set ON_ERROR_STOP on

begin;

update public.obs_router_policy_config
set active_version = 'V5',
    campaign_enabled = false,
    updated_at = now()
where policy_key = 'OT_GENERAL';

alter table public.obs_router_policy_config
  drop constraint if exists obs_router_policy_version_ck;

alter table public.obs_router_policy_config
  add constraint obs_router_policy_version_ck
  check (
    active_version in ('V3', 'V4', 'V5')
    and shadow_version in ('V3', 'V4', 'V5')
    and active_version <> shadow_version
  );

commit;
