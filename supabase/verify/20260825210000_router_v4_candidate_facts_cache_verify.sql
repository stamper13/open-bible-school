begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
declare
  v_function text;
  v_fact_rows integer;
  v_valid_rows integer;
begin
  if to_regclass('public.obs_router_candidate_facts') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: obs_router_candidate_facts table is missing.';
  end if;

  select count(*)::integer,
         count(*) filter (where is_valid_assessment_candidate)::integer
  into v_fact_rows, v_valid_rows
  from public.obs_router_candidate_facts;

  if v_fact_rows < 1000 or v_valid_rows < 1000 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'FAIL: obs_router_candidate_facts has too few rows: %s total, %s valid.',
        v_fact_rows,
        v_valid_rows
      );
  end if;

  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v4(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_function;

  if v_function not like '%v4 router candidate facts cache%'
     or v_function not like '%obs_router_candidate_facts question%'
     or v_function not like '%question.effective_a%'
     or v_function not like '%question.effective_b%'
     or v_function not like '%question.information_reliability%'
     or v_function not like '%question.is_valid_assessment_candidate%' then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: V4 ranker is not using the candidate facts cache.';
  end if;

  if not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag = '20260825210000_router_v4_candidate_facts_cache'
      and backup.object_name = 'obs_rank_ot_assessment_candidates_v4'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: rollback backup for obs_rank_ot_assessment_candidates_v4 is missing.';
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
  v_attempt_id uuid := gen_random_uuid();
  v_candidate uuid;
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
    v_attempt_id,
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

  select generated_question_id
  into v_candidate
  from public.obs_rank_ot_assessment_candidates_v4(
    v_attempt_id,
    v_user_id,
    'V4',
    null,
    now(),
    25
  )
  limit 1;

  if v_candidate is null then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: cached V4 ranker returned no candidate.';
  end if;
end
$$;

rollback;
