do $$
declare
  wrapper_definition text;
begin
  if to_regprocedure('public.obs_get_user_recommendation_v2(uuid)') is null then
    raise exception 'Missing gated recommendation wrapper';
  end if;

  if to_regprocedure('public.obs_get_user_recommendation_v2_ungated(uuid)') is null then
    raise exception 'Missing preserved ungated recommendation implementation';
  end if;

  select pg_get_functiondef(
    'public.obs_get_user_recommendation_v2(uuid)'::regprocedure
  )
  into wrapper_definition;

  if wrapper_definition not like '%canonical_ot_sections%'
     or wrapper_definition not like '%coalesce(answer_count.answered, 0) < 15%'
     or wrapper_definition not like '%obs_get_user_recommendation_v2_ungated%' then
    raise exception 'Recommendation wrapper is missing the 15-answer per-section gate.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.obs_get_user_recommendation_v2(uuid)',
    'execute'
  ) is not true then
    raise exception 'authenticated cannot execute gated recommendation wrapper';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.obs_get_user_recommendation_v2_ungated(uuid)',
    'execute'
  ) is true then
    raise exception 'authenticated can execute ungated recommendation implementation';
  end if;

  raise notice 'PASS: ordinary recommendations are gated behind 15 eligible answers in every canonical OT section.';
end;
$$;
