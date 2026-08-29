\set ON_ERROR_STOP on

begin;

update public.obs_router_policy_config
set active_version = 'V5',
    campaign_enabled = false,
    updated_at = now()
where policy_key = 'OT_GENERAL';

commit;
