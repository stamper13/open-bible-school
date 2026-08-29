begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  v_ranker text;
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_ranker;

  if v_ranker not like '%cross-attempt exact and similarity suppression in v6 ranker%'
     or v_ranker not like '%long-run dimension max-share brake%'
     or v_ranker not like '%long-run section max-share brake%'
     or v_ranker not like '%broad high-specificity demotion in v6 ranker%'
     or v_ranker not like '%obs_assessment_question_similarity_key(%' then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: v6 ranker is missing history-aware novelty or long-run brake hooks.';
  end if;

  if not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag = '20260823170000_router_v6_20_history_aware_long_run_brakes'
      and backup.object_name = 'obs_rank_ot_assessment_candidates_v6'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: v6 step 20 did not capture a rollback definition.';
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
  v_second_question uuid;
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
      message = 'FAIL: v6 ranker returned no candidate for the synthetic probe.';
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
    false,
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

  select ranked.generated_question_id
  into v_second_question
  from public.obs_rank_ot_assessment_candidates_v6(
    v_current_attempt,
    v_user_id,
    'V6',
    null,
    now(),
    25
  ) ranked
  limit 1;

  if v_candidate_count > 1 and v_second_question = v_first_question then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: exact cross-attempt history did not demote the prior top v6 candidate.';
  end if;
end
$$;

rollback;
