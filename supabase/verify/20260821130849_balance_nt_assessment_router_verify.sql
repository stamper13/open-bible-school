do $verify$
declare
  v_definition text := pg_get_functiondef(
    'public.obs_get_next_nt_assessment_question(uuid)'::regprocedure
  );
begin
  if v_definition not like '%division_progress as (%' then
    raise exception 'NT selector is missing division progress balancing.';
  end if;

  if v_definition not like '%division_answered%' then
    raise exception 'NT selector is missing division_answered ordering.';
  end if;

  if v_definition not like '%nt-early-division%' or v_definition not like '%nt-early-book%' then
    raise exception 'NT selector is missing early seeded tie-breakers.';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.obs_get_next_nt_assessment_question(uuid)',
       'execute'
     )
  then
    raise exception 'Authenticated users cannot execute the NT next-question selector.';
  end if;
end
$verify$;
