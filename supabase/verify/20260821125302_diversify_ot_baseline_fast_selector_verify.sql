-- Read-only structural verification for the OT fast-selector diversification
-- patch. Data-distribution checks should be run against production-like data.

do $verify$
declare
  v_definition text := pg_get_functiondef(
    'public.obs_get_next_ot_baseline_question_fast(uuid,uuid)'::regprocedure
  );
  v_volatility "char";
begin
  if to_regprocedure(
       'public.obs_assessment_question_similarity_key(jsonb,text,text,text,text)'
     ) is null then
    raise exception 'OT similarity-key helper is missing.';
  end if;

  select proc.provolatile
  into strict v_volatility
  from pg_proc proc
  where proc.oid = 'public.obs_get_next_ot_baseline_question_fast(uuid,uuid)'::regprocedure;

  if v_volatility <> 'v' then
    raise exception 'Fast OT selector must be VOLATILE so repeated next-question calls see fresh answers.';
  end if;

  if v_definition not like '%obs_assessment_question_similarity_key%' then
    raise exception 'Fast OT selector is not using the similarity-key duplicate guard.';
  end if;

  if v_definition not like '%:early-section:%'
     or v_definition not like '%:early-book:%'
     or v_definition not like '%:early-question:%' then
    raise exception 'Fast OT selector is missing early seeded diversification tie-breakers.';
  end if;

  if has_function_privilege(
       'anon',
       'public.obs_get_next_ot_baseline_question_fast(uuid,uuid)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.obs_get_next_ot_baseline_question_fast(uuid,uuid)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.obs_get_next_ot_baseline_question_fast(uuid,uuid)',
       'execute'
     )
  then
    raise exception 'Fast OT selector execute privileges are not the expected authenticated/service_role surface.';
  end if;

  if has_function_privilege(
       'anon',
       'public.obs_assessment_question_similarity_key(jsonb,text,text,text,text)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.obs_assessment_question_similarity_key(jsonb,text,text,text,text)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.obs_assessment_question_similarity_key(jsonb,text,text,text,text)',
       'execute'
     )
  then
    raise exception 'OT similarity-key helper execute privileges are not least-privilege.';
  end if;
end
$verify$;
