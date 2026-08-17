do $$
declare
  v_signature text;
  v_signatures constant text[] := array[
    'public.request_custom_exam(text)',
    'public.mark_exam_generated(uuid)',
    'public.submit_exam_results(uuid,jsonb)'
  ];
begin
  foreach v_signature in array v_signatures
  loop
    if to_regprocedure(v_signature) is null then
      raise exception using
        errcode = 'P0001',
        message = format('Credential RPC is missing: %s', v_signature);
    end if;

    if has_function_privilege('anon', v_signature, 'execute')
      or has_function_privilege('authenticated', v_signature, 'execute')
      or not has_function_privilege('service_role', v_signature, 'execute')
    then
      raise exception using
        errcode = 'P0001',
        message = format('Credential RPC privileges are unsafe: %s', v_signature);
    end if;
  end loop;
end;
$$;

select
  'PASS: legacy credential exam mutations are service-role only.'
  as result;
