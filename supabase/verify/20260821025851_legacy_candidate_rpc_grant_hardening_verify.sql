do $$
declare
  v_bad_client_grants jsonb;
  v_missing_service_grants jsonb;
  v_bad_refs jsonb;
begin
  with hardened(signature) as (
    values
      ('public.backfill_questions_from_ot_generated(text,integer)'),
      ('public.generate_command_mcq_v1(text,integer)'),
      ('public.generate_command_subject_mcq_v1(text,integer)'),
      ('public.generate_numeric_mcq_v1(text,text,integer)'),
      ('public.generate_promise_mcq_v1(integer)'),
      ('public.generate_sequence_adjacent_mcq_v1(text,integer)'),
      ('public.generate_sequence_first_mcq_v1(text,integer)'),
      ('public.generate_sequence_last_mcq_v1(text,integer)'),
      ('public.generate_sequence_order_mcq_v1(text,integer)'),
      ('public.generate_speech_mcq_v1(text,text,integer)'),
      ('public.get_mcq_event_entity_v1(text,integer)'),
      ('public.load_generated_questions(text,text,integer,text,text)'),
      ('public.mcq_pack_v1(text,uuid,text,jsonb,integer)'),
      ('public.update_theta_from_answer_v1(uuid,text,uuid,boolean)')
  ), function_refs as (
    select
      hardened.signature,
      ref_p.proname as referrer_name
    from hardened
    join pg_proc target on target.oid = to_regprocedure(hardened.signature)
    join pg_proc ref_p on ref_p.oid <> target.oid
      and lower(ref_p.prosrc) like '%' || lower(target.proname) || '(%'
    join pg_namespace ref_n on ref_n.oid = ref_p.pronamespace
    where ref_n.nspname in ('public', 'private')
  )
  select
    coalesce(jsonb_agg(signature order by signature) filter (
      where has_function_privilege('anon', to_regprocedure(signature), 'execute')
        or has_function_privilege('authenticated', to_regprocedure(signature), 'execute')
    ), '[]'::jsonb),
    coalesce(jsonb_agg(signature order by signature) filter (
      where not has_function_privilege('service_role', to_regprocedure(signature), 'execute')
    ), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(function_refs) order by signature, referrer_name) from function_refs), '[]'::jsonb)
  into v_bad_client_grants, v_missing_service_grants, v_bad_refs
  from hardened;

  if jsonb_array_length(v_bad_client_grants) > 0 then
    raise exception 'FAIL: hardened legacy helper RPCs remain client-executable: %', v_bad_client_grants;
  end if;

  if jsonb_array_length(v_missing_service_grants) > 0 then
    raise exception 'FAIL: hardened legacy helper RPCs are missing service_role execute: %', v_missing_service_grants;
  end if;

  if jsonb_array_length(v_bad_refs) > 0 then
    raise exception 'FAIL: hardened legacy helper RPCs gained function-body references: %', v_bad_refs;
  end if;
end;
$$;
