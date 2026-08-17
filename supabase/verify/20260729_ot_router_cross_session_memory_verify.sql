do $$
declare
  config_row public.obs_router_policy_config%rowtype;
  rank_definition text;
  focused_definition text;
begin
  select *
  into config_row
  from public.obs_router_policy_config
  where policy_key = 'OT_GENERAL';

  if config_row.exact_repeat_cooldown_days <> 120
     or config_row.focused_repeat_cooldown_days <> 45
     or config_row.weakness_evidence_window_days <> 90
     or config_row.weakness_miss_threshold <> 2
     or abs(config_row.weakness_miss_ratio - 0.67) > 0.000001
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router-memory policy values do not match the ratified defaults.';
  end if;

  if public.obs_router_repeat_bucket(
       null,
       '2026-07-29 00:00:00+00'::timestamptz,
       120
     ) <> 0
     or public.obs_router_repeat_bucket(
       '2026-07-28 00:00:00+00'::timestamptz,
       '2026-07-29 00:00:00+00'::timestamptz,
       120
     ) <> 1
     or public.obs_router_repeat_bucket(
       '2026-03-01 00:00:00+00'::timestamptz,
       '2026-07-29 00:00:00+00'::timestamptz,
       120
     ) <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'Exact-repeat cooldown boundary verification failed.';
  end if;

  if public.obs_router_weakness_priority(1, 1, 0, 2, 0.67) <> -1
     or public.obs_router_weakness_priority(1, 1, 1, 2, 0.67) <> 0
     or public.obs_router_weakness_priority(2, 2, 0, 2, 0.67) <> 1
     or public.obs_router_weakness_priority(3, 2, 0, 2, 0.67) <> 0
     or public.obs_router_weakness_priority(4, 2, 0, 2, 0.67) <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'Weakness confirmation/defer state verification failed.';
  end if;

  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into rank_definition;

  select pg_get_functiondef(
    'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'::regprocedure
  )
  into focused_definition;

  if rank_definition not like '%attempt_cells as (%'
     or rank_definition not like '%recent_cell_state as (%'
     or rank_definition not like
       '%public.obs_router_weakness_priority(%'
     or rank_definition not like
       '%repeat_cooldown_bucket,%weakness_priority,%route_priority,%'
     or focused_definition not like
       '%candidate.repeat_cooldown_bucket,%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Installed router definitions are missing memory-policy wiring.';
  end if;

  raise notice
    'PASS: cross-session repeat cooldown, one-probe confirmation, confirmed-weakness deferral, and focused-retest fallback are installed.';
end
$$;

select
  policy_key,
  active_version,
  exact_repeat_cooldown_days,
  focused_repeat_cooldown_days,
  weakness_evidence_window_days,
  weakness_miss_threshold,
  weakness_miss_ratio
from public.obs_router_policy_config
where policy_key = 'OT_GENERAL';
