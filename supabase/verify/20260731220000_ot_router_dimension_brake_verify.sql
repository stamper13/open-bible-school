do $$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  );

  if public.obs_router_dimension_brake_stage(3, 1, 1) <> 3
    or public.obs_router_dimension_brake_stage(3, 2, 2) <> 2
    or public.obs_router_dimension_brake_stage(2, 5, 3) <> 1
    or public.obs_router_dimension_brake_stage(1, 5, 3) <> 1
  then
    raise exception using
      errcode = 'P0001',
      message = 'Dimension-stage brake truth table failed';
  end if;

  if public.obs_router_dimension_brake_bucket(2, 2) <> 0
    or public.obs_router_dimension_brake_bucket(3, 2) <> 1
    or public.obs_router_dimension_brake_bucket(5, 1) <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'Dimension concentration truth table failed';
  end if;

  if v_definition not like '%dimension_session_state as (%'
    or v_definition not like '%dimension_session_answered%'
    or v_definition not like '%dimension_session_misses%'
    or v_definition not like '%obs_router_dimension_brake_stage(%'
    or v_definition not like '%dimension_brake_bucket%'
    or v_definition not like '%theta.target_theta - case%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Dimension brake is not fully wired into the OT V4 router';
  end if;
end;
$$;

select
  'PASS: repeated misses lower only that dimension and cap its session follow-up.'
  as result;
