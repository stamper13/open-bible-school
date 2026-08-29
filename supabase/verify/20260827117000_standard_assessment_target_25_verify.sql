begin;

do $$
declare
  v_failures text[] := array[]::text[];
  v_ot_start text;
  v_ot_start_v2 text;
  v_nt_start text;
begin
  select pg_get_functiondef(
    'public.obs_start_or_resume_ot_assessment(text,text,integer,integer,integer,boolean)'::regprocedure
  )
  into v_ot_start;

  select pg_get_functiondef(
    'public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)'::regprocedure
  )
  into v_ot_start_v2;

  select pg_get_functiondef(
    'public.obs_start_nt_assessment(text,text,integer)'::regprocedure
  )
  into v_nt_start;

  if coalesce(v_ot_start, '') not like '%p_target_question_count integer DEFAULT 25%' then
    v_failures := v_failures || 'OT start RPC default target is not 25';
  end if;

  if coalesce(v_ot_start, '') not like '%coalesce(p_target_question_count, 25)%' then
    v_failures := v_failures || 'OT start RPC null target fallback is not 25';
  end if;

  if coalesce(v_ot_start_v2, '') not like '%p_target_question_count integer DEFAULT 25%' then
    v_failures := v_failures || 'OT v2 start RPC default target is not 25';
  end if;

  if coalesce(v_ot_start_v2, '') not like '%obs_start_or_resume_ot_assessment%' then
    v_failures := v_failures || 'OT v2 start RPC no longer delegates to the base OT start RPC';
  end if;

  if coalesce(v_nt_start, '') not like '%p_target_question_count integer DEFAULT 25%' then
    v_failures := v_failures || 'NT start RPC default target is not 25';
  end if;

  if coalesce(v_nt_start, '') not like '%coalesce(p_target_question_count, 25)%' then
    v_failures := v_failures || 'NT start RPC null target fallback is not 25';
  end if;

  if to_regprocedure('public.obs_get_next_ot_assessment_question(uuid)') is null
     or to_regprocedure(
       'public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)'
     ) is null then
    v_failures := v_failures
      || 'app-facing OT RPC chain no longer resolves';
  end if;

  if to_regprocedure('public.obs_get_next_nt_assessment_question(uuid)') is null
     or to_regprocedure(
       'public.obs_submit_nt_assessment_answer(uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.obs_start_nt_assessment(text,text,integer)'
     ) is null then
    v_failures := v_failures
      || 'app-facing NT RPC chain no longer resolves';
  end if;

  if array_length(v_failures, 1) is not null then
    raise exception using
      errcode = 'P0001',
      message = '20260827117000_standard_assessment_target_25_verify failed: '
        || array_to_string(v_failures, '; ');
  end if;
end
$$;

rollback;
