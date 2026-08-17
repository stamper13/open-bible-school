do $$
declare
  v_failures text[] := array[]::text[];
begin
  if has_function_privilege('anon', 'public.select_exam_questions(text,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.select_exam_questions(text,uuid)', 'execute') then
    v_failures := array_append(v_failures, 'select_exam_questions remains client-executable');
  end if;

  if has_function_privilege('anon', 'public.generate_full_exam()', 'execute')
     or has_function_privilege('authenticated', 'public.generate_full_exam()', 'execute') then
    v_failures := array_append(v_failures, 'generate_full_exam remains client-executable');
  end if;

  if has_function_privilege('anon', 'public.get_user_section_scores(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.get_user_section_scores(uuid)', 'execute') then
    v_failures := array_append(v_failures, 'get_user_section_scores remains client-executable');
  end if;

  if not has_function_privilege('service_role', 'public.select_exam_questions(text,uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.generate_full_exam()', 'execute')
     or not has_function_privilege('service_role', 'public.get_user_section_scores(uuid)', 'execute') then
    v_failures := array_append(v_failures, 'service_role lost required execution privileges');
  end if;

  if cardinality(v_failures) > 0 then
    raise exception using
      errcode = 'P0001',
      message = array_to_string(v_failures, '; ');
  end if;
end;
$$;

select
  'PASS: legacy answer-key and cross-user profile RPCs are service-role only.' as result;
