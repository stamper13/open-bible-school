do $$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef(
    'public.obs_submit_nt_assessment_answer(uuid,uuid,text)'::regprocedure
  );

  if v_definition not like '%answer.selected_choice_id%'
    or v_definition not like '%as is_idk%'
    or v_definition not like '%recorded NT response cannot be changed%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'NT submission idempotency guard is not fully installed';
  end if;

  if has_function_privilege(
    'anon',
    'public.obs_submit_nt_assessment_answer(uuid,uuid,text)',
    'execute'
  )
    or not has_function_privilege(
      'authenticated',
      'public.obs_submit_nt_assessment_answer(uuid,uuid,text)',
      'execute'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'NT submission privileges are incorrect';
  end if;
end;
$$;

select
  'PASS: NT answer retries are readable, idempotent, and first-write-wins.'
  as result;
