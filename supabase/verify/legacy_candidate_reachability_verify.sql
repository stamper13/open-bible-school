-- Verifies the first deletion/consolidation candidate set has no current
-- database reachability through public/private function bodies or triggers.
--
-- This is not a drop verifier. It supports the next safe step: branch-only
-- grant hardening for legacy helper RPCs, followed by a release soak before
-- any destructive cleanup.

do $$
declare
  v_body_refs jsonb;
  v_trigger_refs jsonb;
  v_service_only_regressions jsonb;
  v_client_executable_review jsonb;
begin
  with candidate(name, group_name, expected_posture) as (
    values
      ('backfill_questions_from_ot_generated', 'old generator/load', 'revoke-client-execute'),
      ('generate_command_mcq_v1', 'old generator/load', 'revoke-client-execute'),
      ('generate_command_subject_mcq_v1', 'old generator/load', 'revoke-client-execute'),
      ('generate_numeric_mcq_v1', 'old generator/load', 'revoke-client-execute'),
      ('generate_promise_mcq_v1', 'old generator/load', 'revoke-client-execute'),
      ('generate_sequence_adjacent_mcq_v1', 'old generator/load', 'revoke-client-execute'),
      ('generate_sequence_first_mcq_v1', 'old generator/load', 'revoke-client-execute'),
      ('generate_sequence_last_mcq_v1', 'old generator/load', 'revoke-client-execute'),
      ('generate_sequence_order_mcq_v1', 'old generator/load', 'revoke-client-execute'),
      ('generate_speech_mcq_v1', 'old generator/load', 'revoke-client-execute'),
      ('get_mcq_event_entity_v1', 'old generator/load', 'revoke-client-execute'),
      ('load_generated_questions', 'old generator/load', 'revoke-client-execute'),
      ('mcq_pack_v1', 'old generator/load', 'revoke-client-execute'),
      ('update_theta_from_answer_v1', 'older theta helper', 'revoke-client-execute'),
      ('nt_get_pilot_questions', 'old nt pilot', 'service-only'),
      ('nt_submit_pilot_answer', 'old nt pilot', 'service-only'),
      ('generate_full_exam', 'credential exam', 'service-only'),
      ('request_custom_exam', 'credential exam', 'service-only'),
      ('mark_exam_generated', 'credential exam', 'service-only'),
      ('submit_exam_results', 'credential exam', 'service-only'),
      ('obs_get_user_recommendation_pre_ladder', 'older recommendation', 'review-authenticated-execute'),
      ('get_next_scoped_assessment_question', 'legacy scoped selector', 'review-authenticated-execute')
  ), live_candidate as (
    select c.*, p.oid
    from candidate c
    join pg_proc p on p.proname = c.name
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  ), body_refs as (
    select
      target.name as candidate_name,
      target.group_name,
      ref_p.proname as referrer_name
    from live_candidate target
    join pg_proc ref_p on ref_p.oid <> target.oid
      and lower(ref_p.prosrc) like '%' || lower(target.name) || '(%'
    join pg_namespace ref_n on ref_n.oid = ref_p.pronamespace
    where ref_n.nspname in ('public', 'private')
  ), trigger_refs as (
    select
      target.name as candidate_name,
      target.group_name,
      t.tgname as trigger_name
    from live_candidate target
    join pg_trigger t on t.tgfoid = target.oid
    where not t.tgisinternal
  ), service_only_regressions as (
    select
      target.name,
      target.group_name
    from live_candidate target
    where target.expected_posture = 'service-only'
      and (
        has_function_privilege('anon', target.oid, 'execute')
        or has_function_privilege('authenticated', target.oid, 'execute')
      )
  ), client_executable_review as (
    select
      target.name,
      target.group_name,
      target.expected_posture,
      has_function_privilege('anon', target.oid, 'execute') as anon_execute,
      has_function_privilege('authenticated', target.oid, 'execute') as authenticated_execute
    from live_candidate target
    where target.expected_posture <> 'service-only'
      and (
        has_function_privilege('anon', target.oid, 'execute')
        or has_function_privilege('authenticated', target.oid, 'execute')
      )
  )
  select
    coalesce((select jsonb_agg(to_jsonb(body_refs) order by candidate_name, referrer_name) from body_refs), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(trigger_refs) order by candidate_name, trigger_name) from trigger_refs), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(service_only_regressions) order by name) from service_only_regressions), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(client_executable_review) order by name) from client_executable_review), '[]'::jsonb)
  into v_body_refs, v_trigger_refs, v_service_only_regressions, v_client_executable_review;

  if jsonb_array_length(v_body_refs) > 0 then
    raise exception 'FAIL: legacy deletion candidates are still referenced by function bodies: %', v_body_refs;
  end if;

  if jsonb_array_length(v_trigger_refs) > 0 then
    raise exception 'FAIL: legacy deletion candidates are still referenced by triggers: %', v_trigger_refs;
  end if;

  if jsonb_array_length(v_service_only_regressions) > 0 then
    raise exception 'FAIL: service-only legacy candidates are client-executable: %', v_service_only_regressions;
  end if;

  if jsonb_array_length(v_client_executable_review) > 0 then
    raise notice 'Legacy candidates still needing grant review: %', v_client_executable_review;
  end if;
end;
$$;
