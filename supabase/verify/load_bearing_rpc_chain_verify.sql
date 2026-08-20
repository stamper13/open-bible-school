-- Verifies indirect RPC dependencies that cannot be found by frontend grep alone.

do $$
declare
  v_start_v2 regprocedure :=
    'public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)'::regprocedure;
  v_start_legacy regprocedure :=
    'public.obs_start_or_resume_ot_assessment(text,text,integer,integer,integer,boolean)'::regprocedure;
  v_scope_start regprocedure :=
    'public.obs_start_or_resume_ot_scope_assessment(text,text,integer,boolean)'::regprocedure;
  v_submit_v2 regprocedure :=
    'public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)'::regprocedure;
  v_submit_response regprocedure :=
    'public.obs_submit_ot_assessment_response(uuid,uuid,text)'::regprocedure;
  v_submit_answer regprocedure :=
    'public.obs_submit_ot_assessment_answer(uuid,uuid,text)'::regprocedure;
  v_submit_v1 regprocedure :=
    'public.submit_assessment_answer_v1(uuid,uuid,uuid,text)'::regprocedure;
  v_submit_grader regprocedure :=
    'public.submit_assessment_answer_v2(uuid,uuid,uuid,text)'::regprocedure;
  v_issue_transfer regprocedure :=
    'public.obs_issue_anonymous_transfer_token()'::regprocedure;
  v_claim_transfer regprocedure :=
    'public.obs_claim_anonymous_transfer(text)'::regprocedure;
begin
  if lower(pg_get_functiondef(v_start_v2)) not like '%obs_start_or_resume_ot_assessment(%' then
    raise exception 'FAIL: OT start v2 no longer delegates to legacy start implementation.';
  end if;

  if lower(pg_get_functiondef(v_submit_v2)) not like '%obs_submit_ot_assessment_response(%'
     or lower(pg_get_functiondef(v_submit_response)) not like '%obs_submit_ot_assessment_answer(%'
     or lower(pg_get_functiondef(v_submit_answer)) not like '%submit_assessment_answer_v1(%'
     or lower(pg_get_functiondef(v_submit_v1)) not like '%submit_assessment_answer_v2(%'
     or lower(pg_get_functiondef(v_submit_grader)) not like '%update_theta_internal%'
  then
    raise exception 'FAIL: OT submit chain lost an expected internal dependency.';
  end if;

  if (
    select count(*)
    from pg_proc
    where oid in (
      v_start_v2,
      v_start_legacy,
      v_scope_start,
      v_submit_v2,
      v_submit_response,
      v_submit_answer,
      v_submit_v1,
      v_submit_grader
    )
      and prosecdef
      and proconfig = array['search_path=public']
  ) <> 8 then
    raise exception 'FAIL: load-bearing assessment RPCs must be SECURITY DEFINER with search_path=public.';
  end if;

  if (
    select count(*)
    from pg_proc
    where oid in (v_issue_transfer, v_claim_transfer)
      and prosecdef
      and proconfig = array['search_path=public, auth, extensions, pg_temp']
  ) <> 2 then
    raise exception 'FAIL: anonymous-transfer RPCs must pin the expected public/auth/extensions/pg_temp search_path.';
  end if;

  if has_function_privilege('anon', v_start_v2, 'execute')
     or has_function_privilege('anon', v_scope_start, 'execute')
     or has_function_privilege('anon', v_submit_v2, 'execute')
     or has_function_privilege('anon', v_submit_response, 'execute')
     or has_function_privilege('anon', v_submit_v1, 'execute')
     or has_function_privilege('anon', v_submit_grader, 'execute')
  then
    raise exception 'FAIL: anon can execute an authenticated OT assessment RPC.';
  end if;

  if not has_function_privilege('authenticated', v_start_v2, 'execute')
     or not has_function_privilege('authenticated', v_scope_start, 'execute')
     or not has_function_privilege('authenticated', v_submit_v2, 'execute')
     or has_function_privilege('authenticated', v_submit_response, 'execute')
     or has_function_privilege('authenticated', v_submit_v1, 'execute')
     or has_function_privilege('authenticated', v_submit_grader, 'execute')
  then
    raise exception 'FAIL: authenticated grant surface for OT assessment RPCs is not the expected wrapper-only shape.';
  end if;

  if not has_function_privilege('authenticated', v_issue_transfer, 'execute')
     or not has_function_privilege('authenticated', v_claim_transfer, 'execute')
     or has_function_privilege('anon', v_issue_transfer, 'execute')
     or has_function_privilege('anon', v_claim_transfer, 'execute')
  then
    raise exception 'FAIL: anonymous-transfer RPC grant surface is not the expected authenticated-only shape.';
  end if;
end;
$$;
