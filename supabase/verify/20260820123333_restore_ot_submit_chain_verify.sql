do $$
declare
  v_submit_v1 regprocedure :=
    'public.submit_assessment_answer_v1(uuid,uuid,uuid,text)'::regprocedure;
  v_submit_v2 regprocedure :=
    'public.submit_assessment_answer_v2(uuid,uuid,uuid,text)'::regprocedure;
  v_response regprocedure :=
    'public.obs_submit_ot_assessment_response(uuid,uuid,text)'::regprocedure;
  v_response_v2 regprocedure :=
    'public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)'::regprocedure;
  v_answer regprocedure :=
    'public.obs_submit_ot_assessment_answer(uuid,uuid,text)'::regprocedure;
  v_v1_def text := lower(pg_get_functiondef(v_submit_v1));
  v_v2_def text := lower(pg_get_functiondef(v_submit_v2));
  v_response_def text := lower(pg_get_functiondef(v_response));
  v_response_v2_def text := lower(pg_get_functiondef(v_response_v2));
  v_answer_def text := lower(pg_get_functiondef(v_answer));
begin
  if (
    select count(*)
    from pg_proc
    where oid in (v_submit_v1, v_submit_v2, v_response)
      and prosecdef
      and proconfig = array['search_path=public']
  ) <> 3 then
    raise exception 'FAIL: restored OT submit-chain functions must be SECURITY DEFINER with search_path=public.';
  end if;

  if has_function_privilege('anon', v_response, 'execute')
     or has_function_privilege('authenticated', v_response, 'execute')
     or has_function_privilege('authenticated', v_submit_v1, 'execute')
     or has_function_privilege('authenticated', v_submit_v2, 'execute')
  then
    raise exception 'FAIL: restored OT submit-chain internals must not be directly executable by client roles.';
  end if;

  if not has_function_privilege('authenticated', v_response_v2, 'execute') then
    raise exception 'FAIL: browser-facing obs_submit_ot_assessment_response_v2 must remain executable by authenticated.';
  end if;

  if v_response_v2_def not like '%obs_submit_ot_assessment_response(%'
     or v_response_def not like '%obs_submit_ot_assessment_answer(%'
     or v_response_def not like '%obs_is_order_response_question%'
     or v_answer_def not like '%submit_assessment_answer_v1(%'
     or v_v1_def not like '%submit_assessment_answer_v2(%'
     or v_v2_def not like '%update_theta_internal%'
  then
    raise exception 'FAIL: restored OT submit-chain delegation or grading body changed unexpectedly.';
  end if;
end;
$$;
