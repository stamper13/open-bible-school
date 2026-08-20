do $$
declare
  v2_definition text;
begin
  if not exists (
    select 1
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'obs_start_or_resume_ot_assessment'
      and pg_get_function_arguments(p.oid) =
        'p_unit_key text DEFAULT NULL::text, p_book_code text DEFAULT NULL::text, p_start_chapter integer DEFAULT NULL::integer, p_end_chapter integer DEFAULT NULL::integer, p_target_question_count integer DEFAULT 20, p_force_new boolean DEFAULT false'
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'obs_start_or_resume_ot_assessment (6-arg) was not restored with the expected signature.';
  end if;

  select pg_get_functiondef(
    'public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)'::regprocedure
  )
  into v2_definition;

  if v2_definition not like '%obs_start_or_resume_ot_assessment(%'
  then
    raise exception using
      errcode = 'P0001',
      message =
        'obs_start_or_resume_ot_assessment_v2 no longer delegates to the restored function -- this fix no longer applies.';
  end if;

  if not has_function_privilege(
    'authenticated', 'public.obs_start_or_resume_ot_assessment(text,text,integer,integer,integer,boolean)', 'execute'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'authenticated role lost execute on the restored function.';
  end if;

  raise notice
    'PASS: obs_start_or_resume_ot_assessment is restored with the expected signature, obs_start_or_resume_ot_assessment_v2 still delegates to it for the non-focused-retest path, and authenticated has execute.';
end
$$;
