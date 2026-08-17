do $$
declare
  v_oid oid := to_regprocedure(
    'public.migrate_anonymous_data(uuid,uuid)'
  );
  v_definition text;
begin
  if v_oid is null then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: migration function is missing';
  end if;

  v_definition := lower(pg_get_functiondef(v_oid));

  if has_function_privilege('anon', v_oid, 'execute') then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: anon can execute migration';
  end if;

  if not has_function_privilege('authenticated', v_oid, 'execute') then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: authenticated cannot execute migration';
  end if;

  if v_definition not like '%auth.uid()%'
    or v_definition not like '%is_anonymous%'
    or v_definition not like '%p_new_user_id%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: identity checks are incomplete';
  end if;
end;
$$;

select
  'PASS: anonymous progress transfer is destination-authorized, '
  || 'registered sources are rejected, and anon execution is revoked.'
  as result;
