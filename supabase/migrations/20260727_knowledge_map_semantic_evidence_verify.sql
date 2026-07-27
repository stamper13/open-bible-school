do $$
declare
  function_count integer;
  is_security_definer boolean;
  authenticated_can_execute boolean;
  anonymous_can_execute boolean;
begin
  select count(*)
  into function_count
  from pg_proc function_row
  join pg_namespace namespace_row
    on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.proname = 'obs_get_user_knowledge_evidence'
    and pg_get_function_identity_arguments(function_row.oid) = 'p_user_id uuid';

  select function_row.prosecdef
  into is_security_definer
  from pg_proc function_row
  join pg_namespace namespace_row
    on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.proname = 'obs_get_user_knowledge_evidence'
    and pg_get_function_identity_arguments(function_row.oid) = 'p_user_id uuid';

  authenticated_can_execute := has_function_privilege(
    'authenticated',
    'public.obs_get_user_knowledge_evidence(uuid)',
    'execute'
  );
  anonymous_can_execute := has_function_privilege(
    'anon',
    'public.obs_get_user_knowledge_evidence(uuid)',
    'execute'
  );

  if function_count <> 1
     or not coalesce(is_security_definer, false)
     or not authenticated_can_execute
     or anonymous_can_execute
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Semantic evidence verification failed: functions=%s security_definer=%s authenticated_execute=%s anon_execute=%s.',
        function_count,
        coalesce(is_security_definer, false),
        authenticated_can_execute,
        anonymous_can_execute
      );
  end if;
end
$$;

select
  'PASS: semantic knowledge-map evidence function and privileges are present.' as result;
