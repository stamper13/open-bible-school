do $$
declare
  selector_definition text;
  ranking_definition text;
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
      message =
        'OT router v4 is not active with V3 retained for offline replay.';
  end if;

  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into selector_definition;

  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into ranking_definition;

  if selector_definition not like '%active_version%'
     or selector_definition not like
       '%obs_rank_ot_assessment_candidates_v4%'
     or ranking_definition not like '%book_recency_rank%'
     or ranking_definition not like '%recovery_stage%'
     or ranking_definition not like '%back_to_back_miss%'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Production OT selector is not policy-driven or reversible book recovery is missing.';
  end if;

  raise notice
    'PASS: OT router v4 is active; V3 remains available for offline replay comparison and inline shadow is disabled for latency safety.';
end
$$;

select
  active_version,
  shadow_version,
  updated_at
from public.obs_router_policy_config
where policy_key = 'OT_GENERAL';
