-- Activate OT router v4 only after the policy-and-replay verification passes.

begin;

do $$
begin
  if to_regclass('public.obs_router_policy_config') is null
     or to_regprocedure(
       'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'OT router v4 policy foundation is missing; activation aborted.';
  end if;
end
$$;

update public.obs_router_policy_config
set
  active_version = 'V4',
  shadow_version = 'V3',
  shadow_enabled = false,
  updated_at = now()
where policy_key = 'OT_GENERAL';

do $$
begin
  if not exists (
    select 1
    from public.obs_router_policy_config
    where policy_key = 'OT_GENERAL'
      and active_version = 'V4'
      and shadow_version = 'V3'
      and not shadow_enabled
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'OT router v4 activation did not persist.';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
