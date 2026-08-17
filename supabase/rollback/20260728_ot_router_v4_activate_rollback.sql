begin;

update public.obs_router_policy_config
set
  active_version = 'V3',
  shadow_version = 'V4',
  shadow_enabled = false,
  updated_at = now()
where policy_key = 'OT_GENERAL';

notify pgrst, 'reload schema';

commit;
