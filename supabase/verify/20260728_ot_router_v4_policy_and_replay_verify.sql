-- Fail-loud installation verification. The general policy must still be V3.

do $$
declare
  config_row record;
  adjusted record;
  stale record;
  fallback record;
  selector_definition text;
  focused_definition text;
  ranking_definition text;
  adjusted_theta_definition text;
  representative record;
  v3_candidate record;
  v4_candidate record;
begin
  if to_regclass('public.obs_router_policy_config') is null
     or to_regclass('public.obs_router_shadow_log') is null
     or to_regprocedure(
       'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'
     ) is null
     or to_regprocedure(
       'public.obs_replay_ot_router_attempt(uuid)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'OT router v4 policy or replay objects are missing.';
  end if;

  select *
  into config_row
  from public.obs_router_policy_config
  where policy_key = 'OT_GENERAL';

  if config_row.active_version <> 'V3'
     or config_row.shadow_version <> 'V4'
     or config_row.shadow_enabled
     or config_row.exploration_every_n <> 7
     or config_row.shadow_sample_every_n <> 5
  then
    raise exception using
      errcode = 'P0001',
      message =
        'OT router v4 installation changed policy prematurely or has unexpected defaults.';
  end if;

  if public.obs_router_confirmation_stage(
       'book_orientation', 1, true, false, false
     ) <> 2
     or public.obs_router_confirmation_stage(
       'book_orientation', 1, false, false, false
     ) <> 1
     or public.obs_router_confirmation_stage(
       null, 3, false, false, false
     ) <> 2
     or public.obs_router_confirmation_stage(
       null, 2, false, false, false
     ) <> 1
     or public.obs_router_confirmation_stage(
       null, 1, false, false, true
     ) is not null
     or public.obs_router_confirmation_stage(
       null, 2, true, false, false
     ) is not null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Reversible confirmation/demotion transitions do not match policy.';
  end if;

  if public.obs_general_route_priority_v4(
       'ISA', 2, 'ISA', 1, true, 0, false,
       null, 2, 3
     ) <> -2
     or public.obs_general_route_priority_v4(
       'ISA', 2, 'ISA', 1, true, 0, false,
       null, 1, 3
     ) <> -1
     or public.obs_general_route_priority_v4(
       null, null, 'ISA', 0, false, 0, false,
       'book_orientation', 1, 2
     ) <> 0
     or public.obs_general_route_priority_v4(
       null, null, 'ISA', 1, true, 0, false,
       null, 2, 3
     ) <> 0
     or public.obs_general_route_priority_v4(
       null, null, 'ISA', 1, true, 1, false,
       null, 3, 3
     ) <> 1
  then
    raise exception using
      errcode = 'P0001',
      message =
        'V4 same-book confirmation or two-evidence promotion priority failed.';
  end if;

  select *
  into adjusted
  from public.obs_router_adjusted_theta(
    1.0, 0.20, 10, '2026-07-28 00:00:00+00',
    0.0, 0.40, 20, '2026-07-28 00:00:00+00',
    1, '2026-07-28 00:00:00+00'
  );

  select *
  into stale
  from public.obs_router_adjusted_theta(
    1.0, 0.20, 10, '2025-07-28 00:00:00+00',
    0.0, 0.40, 20, '2026-07-28 00:00:00+00',
    1, '2026-07-28 00:00:00+00'
  );

  select *
  into fallback
  from public.obs_router_adjusted_theta(
    null, null, 0, null,
    null, null, 0, null,
    2, '2026-07-28 00:00:00+00'
  );

  if adjusted.theta_source <> 'SECTION'
     or abs(adjusted.target_theta - 0.90) > 0.000001
     or stale.effective_se <= adjusted.effective_se
     or stale.target_theta >= adjusted.target_theta
     or fallback.theta_source <> 'SESSION_FALLBACK'
     or fallback.target_theta <> 0.0
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Theta source selection, LCB, or time-based uncertainty inflation failed.';
  end if;

  if public.obs_router_stage_from_theta(-0.6, 3) <> 1
     or public.obs_router_stage_from_theta(0.0, 1) <> 2
     or public.obs_router_stage_from_theta(0.8, 1) <> 3
     or public.obs_router_stage_from_theta(null, 2) <> 2
     or public.obs_router_information_reliability(
          jsonb_build_object('distractor_distance', 'd2'),
          1.0,
          0.0
        ) <> 1.0
     or public.obs_router_information_reliability(
          jsonb_build_object('irt_a', 1.1, 'irt_b', 0.2),
          null,
          null
        ) <> 0.65
     or public.obs_router_information_reliability(
          '{}'::jsonb,
          1.0,
          0.0
        ) <> 0.35
  then
    raise exception using
      errcode = 'P0001',
      message = 'Theta stage or calibration-confidence policy failed.';
  end if;

  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into selector_definition;

  select pg_get_functiondef(
    'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'::regprocedure
  )
  into focused_definition;

  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into ranking_definition;

  select pg_get_functiondef(
    'public.obs_router_adjusted_theta(double precision,double precision,integer,timestamptz,double precision,double precision,integer,timestamptz,integer,timestamptz)'::regprocedure
  )
  into adjusted_theta_definition;

  if selector_definition not like
       '%obs_rank_ot_assessment_candidates_v4%'
     or selector_definition not like '%obs_router_shadow_log%'
     or selector_definition not like '%active_version%'
     or focused_definition not like '%latest_stage%'
     or focused_definition not like '%latest_correct%'
     or focused_definition not like
       '%obs_advanced_dimension_unlocked%'
     or ranking_definition not like '%information_reliability%'
     or ranking_definition not like '%calibration_need%'
     or ranking_definition not like '%EXPLORE%'
     or ranking_definition not like '%obs_router_adjusted_theta%'
     or adjusted_theta_definition not like '%SESSION_FALLBACK%'
     or ranking_definition not like
       '%obs_router_confirmation_stage%'
     or ranking_definition not like '%book_recency_rank%'
     or ranking_definition not like '%recovery_stage%'
     or ranking_definition not like '%back_to_back_miss%'
     or ranking_definition not like
       '%is_advanced%'
     or ranking_definition like '%random()%'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'Installed selector definitions are missing a V4 safeguard or contain random routing.';
  end if;

  select
    attempt.id,
    attempt.user_id,
    least(attempt.answered_count, 3) as prefix
  into representative
  from public.assessment_attempts attempt
  where attempt.user_id is not null
    and upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and exists (
      select 1
      from public.assessment_answers answer
      where answer.attempt_id = attempt.id
    )
  order by attempt.created_at desc
  limit 1;

  if found then
    select *
    into v3_candidate
    from public.obs_rank_ot_assessment_candidates_v4(
      representative.id,
      representative.user_id,
      'V3',
      representative.prefix,
      now(),
      1
    );

    select *
    into v4_candidate
    from public.obs_rank_ot_assessment_candidates_v4(
      representative.id,
      representative.user_id,
      'V4',
      representative.prefix,
      now(),
      1
    );

    if v3_candidate.generated_question_id is null
       or v4_candidate.generated_question_id is null
    then
      raise exception using
        errcode = 'P0001',
        message =
          'V3 or V4 candidate ranking returned no representative candidate.';
    end if;
  end if;

  raise notice
    'PASS: OT router v4 foundation installed; active=%, replay comparison=%, inline shadow disabled for latency safety; reversible transitions, theta staleness, exploration, advanced gate, and focused downshift verified.',
    config_row.active_version,
    config_row.shadow_version;
end
$$;

select
  policy_key,
  active_version,
  shadow_version,
  shadow_enabled,
  shadow_sample_every_n,
  exploration_every_n,
  theta_lcb_multiplier,
  process_variance_per_day
from public.obs_router_policy_config
where policy_key = 'OT_GENERAL';
