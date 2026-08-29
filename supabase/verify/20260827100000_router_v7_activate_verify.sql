-- Verifies that V7 is active through the app-facing adaptive OT wrapper while
-- the public start/get/submit RPC chain and scoring path remain intact.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';

do $$
declare
  v_function text;
  v_config record;
  v_failures text[] := array[]::text[];
  v_user_id uuid := gen_random_uuid();
  v_attempt_id uuid;
  v_question_id uuid;
  v_top_v7_question_id uuid;
  v_choices jsonb;
  v_answer_payload jsonb;
begin
  select pg_get_functiondef('public.get_next_assessment_question(uuid,uuid)'::regprocedure)
  into v_function;

  select *
  into v_config
  from public.obs_router_policy_config
  where policy_key = 'OT_GENERAL';

  if coalesce(v_config.active_version, '') <> 'V7' then
    v_failures := v_failures || 'OT_GENERAL active_version is not V7';
  end if;

  if coalesce(v_function, '') not like '%v7 app-facing activation%'
     or coalesce(v_function, '') not like '%obs_rank_ot_assessment_candidates_v7%' then
    v_failures := v_failures || 'get_next_assessment_question does not contain the V7 app-facing activation block';
  end if;

  if coalesce(v_function, '') not like '%falling back to V6%'
     or coalesce(v_function, '') not like '%obs_rank_ot_assessment_candidates_v6%'
     or coalesce(v_function, '') not like '%obs_rank_ot_assessment_candidates_v5%' then
    v_failures := v_failures || 'V7 activation does not preserve V6/V5 fallback markers';
  end if;

  if coalesce(pg_get_functiondef('public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)'::regprocedure), '')
       like '%obs_rank_ot_assessment_candidates_v7%' then
    v_failures := v_failures || 'submit/scoring RPC unexpectedly calls V7';
  end if;

  if not has_function_privilege(
      'authenticated',
      'public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.obs_get_next_ot_assessment_question(uuid)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)',
      'execute'
    ) then
    v_failures := v_failures || 'authenticated cannot execute the load-bearing RPC chain';
  end if;

  update public.obs_router_policy_config
  set cold_start_fast_answer_limit = 0
  where policy_key = 'OT_GENERAL';

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_anonymous,
    created_at,
    updated_at
  ) values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'router-v7-verify-' || v_user_id::text || '@example.invalid',
    crypt('router-v7-verify', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    now(),
    now()
  );

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select (to_jsonb(start_row)->>'attempt_id')::uuid
  into v_attempt_id
  from public.obs_start_or_resume_ot_assessment_v2(
    null,
    null,
    null,
    null,
    20,
    true,
    null
  ) start_row;

  if v_attempt_id is null then
    v_failures := v_failures || 'start/resume did not create an OT attempt';
  else
    select ranked.generated_question_id
    into v_top_v7_question_id
    from public.obs_rank_ot_assessment_candidates_v7(
      v_attempt_id,
      v_user_id,
      'V7',
      0,
      now(),
      25
    ) ranked
    order by ranked.candidate_rank
    limit 1;

    select
      question.out_generated_question_id,
      question.choices
    into v_question_id, v_choices
    from public.obs_get_next_ot_assessment_question(v_attempt_id) question
    limit 1;

    if v_question_id is null
       or jsonb_typeof(v_choices) is distinct from 'array'
       or jsonb_array_length(v_choices) <> 4 then
      v_failures := v_failures || 'V7 app-facing next-question path did not return a renderable MCQ';
    elsif v_top_v7_question_id is null or v_question_id <> v_top_v7_question_id then
      v_failures := v_failures || format(
        'app-facing next-question did not use top V7 candidate; app=%s, top_v7=%s',
        v_question_id,
        v_top_v7_question_id
      );
    else
      select to_jsonb(submit_row)
      into v_answer_payload
      from public.obs_submit_ot_assessment_response_v2(
        v_attempt_id,
        v_question_id,
        '__IDK__',
        null,
        v_choices
      ) submit_row;

      if v_answer_payload is null
         or coalesce((v_answer_payload->>'scoring_eligible')::boolean, true) is not true then
        v_failures := v_failures || 'submit path did not score the V7-served question';
      end if;
    end if;
  end if;

  delete from public.assessment_answers where user_id = v_user_id;
  delete from public.assessment_attempts where user_id = v_user_id;
  delete from auth.users where id = v_user_id;

  if array_length(v_failures, 1) is not null then
    raise exception 'FAIL: V7 activation verification failed: %', v_failures;
  end if;

  raise notice 'PASS: V7 activation verifier completed under rollback.';
end
$$;

rollback;
