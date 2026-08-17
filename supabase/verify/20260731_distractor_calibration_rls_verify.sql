do $$
declare
  v_rls_enabled boolean;
begin
  select relation.relrowsecurity
  into v_rls_enabled
  from pg_class relation
  join pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'obs_distractor_distance_calibration';

  if not coalesce(v_rls_enabled, false) then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: calibration table RLS is disabled';
  end if;

  if has_table_privilege(
       'anon',
       'public.obs_distractor_distance_calibration',
       'select'
     )
     or has_table_privilege(
       'authenticated',
       'public.obs_distractor_distance_calibration',
       'select'
     )
  then
    raise exception using
      errcode = 'P0001',
      message = 'Verification failed: calibration table remains client-readable';
  end if;
end;
$$;

select
  'PASS: calibration table RLS is enabled and client reads remain revoked.'
  as result;
