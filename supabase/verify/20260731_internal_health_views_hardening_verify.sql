do $$
declare
  v_view text;
  v_options text[];
begin
  foreach v_view in array array[
    'v_ot_generated_questions_health',
    'v_obs_answer_position_balance'
  ]
  loop
    select relation.reloptions
    into v_options
    from pg_class relation
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = v_view;

    if not coalesce(
      'security_invoker=true' = any(v_options),
      false
    ) then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Verification failed: public.%I is not security-invoker',
          v_view
        );
    end if;

    if has_table_privilege(
         'anon',
         format('public.%I', v_view),
         'select'
       )
       or has_table_privilege(
         'authenticated',
         format('public.%I', v_view),
         'select'
       )
    then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Verification failed: public.%I remains client-readable',
          v_view
        );
    end if;

    if not has_table_privilege(
      'service_role',
      format('public.%I', v_view),
      'select'
    ) then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Verification failed: service_role cannot read public.%I',
          v_view
        );
    end if;
  end loop;
end;
$$;

select
  'PASS: internal health views are security-invoker and service-role only.'
  as result;
