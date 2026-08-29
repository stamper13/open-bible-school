begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
declare
  v_function text;
begin
  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into v_function;

  if v_function not like '%v6 app-wrapper cross-attempt novelty gate%'
     or v_function not like '%prior_answer.attempt_id <> p_attempt_id%'
     or v_function not like '%obs_assessment_question_similarity_key(%' then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: get_next_assessment_question is missing the app-wrapper cross-attempt novelty gate.';
  end if;

  if not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag = '20260825203000_router_v6_23_app_wrapper_cross_attempt_novelty'
      and backup.object_name = 'get_next_assessment_question'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: rollback backup for get_next_assessment_question is missing.';
  end if;
end
$$;

do $$
declare
  v_start_v2 regprocedure :=
    'public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)'::regprocedure;
  v_next regprocedure :=
    'public.obs_get_next_ot_assessment_question(uuid)'::regprocedure;
  v_submit_v2 regprocedure :=
    'public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)'::regprocedure;
begin
  if not has_function_privilege('authenticated', v_start_v2, 'execute')
     or not has_function_privilege('authenticated', v_next, 'execute')
     or not has_function_privilege('authenticated', v_submit_v2, 'execute') then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: app-facing OT RPC chain lost authenticated execute privilege.';
  end if;

  if has_function_privilege('anon', v_start_v2, 'execute')
     or has_function_privilege('anon', v_next, 'execute')
     or has_function_privilege('anon', v_submit_v2, 'execute') then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: app-facing OT RPC chain unexpectedly allows anon execute.';
  end if;
end
$$;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_current_attempt uuid := gen_random_uuid();
  v_prior_attempt uuid := gen_random_uuid();
  v_first_question uuid;
  v_next_question uuid;
  v_candidate_count integer;
begin
  insert into auth.users (
    id,
    aud,
    role,
    is_anonymous,
    created_at,
    updated_at
  ) values (
    v_user_id,
    'authenticated',
    'authenticated',
    true,
    now(),
    now()
  );

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  update public.obs_router_policy_config
  set cold_start_uses_fast_selector = false
  where policy_key = 'OT_GENERAL';

  insert into public.assessment_attempts (
    id,
    user_id,
    prior_self_rating,
    question_target,
    assessment_kind,
    target_question_count,
    total_count,
    testament,
    scope_key,
    assessment_mode
  ) values (
    v_current_attempt,
    v_user_id,
    3,
    50,
    'ot_adaptive',
    50,
    50,
    'OT',
    'OT',
    'adaptive'
  ), (
    v_prior_attempt,
    v_user_id,
    3,
    50,
    'ot_adaptive',
    50,
    50,
    'OT',
    'OT',
    'adaptive'
  );

  select ranked.generated_question_id
  into v_first_question
  from public.obs_rank_ot_assessment_candidates_v6(
    v_current_attempt,
    v_user_id,
    'V6',
    null,
    now(),
    25
  ) ranked
  limit 1;

  if v_first_question is null then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: v6 ranker returned no candidate for wrapper novelty probe.';
  end if;

  insert into public.assessment_answers (
    attempt_id,
    user_id,
    generated_question_id,
    selected_choice_id,
    is_correct,
    is_idk,
    scoring_eligible,
    answered_at
  ) values (
    v_prior_attempt,
    v_user_id,
    v_first_question,
    'A',
    true,
    false,
    true,
    now() - interval '1 day'
  );

  select count(*)::integer
  into v_candidate_count
  from public.obs_rank_ot_assessment_candidates_v6(
    v_current_attempt,
    v_user_id,
    'V6',
    null,
    now(),
    25
  ) ranked;

  select out_generated_question_id
  into v_next_question
  from public.get_next_assessment_question(v_current_attempt, v_user_id)
  limit 1;

  if v_next_question is null then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: get_next_assessment_question returned no candidate for wrapper novelty probe.';
  end if;

  if v_candidate_count > 1 and v_next_question = v_first_question then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: app-wrapper novelty gate did not skip a prior cross-attempt top candidate.';
  end if;
end
$$;

rollback;
