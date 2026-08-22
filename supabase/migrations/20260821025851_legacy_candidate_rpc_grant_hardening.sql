-- Harden old generator/load helper RPCs that are not reached by current app
-- code, current public/private function bodies, or triggers.
--
-- This is intentionally non-destructive: the functions remain available to
-- service_role for one release while manual/content tooling dependencies are
-- confirmed before any later drop migration.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $precondition$
declare
  v_missing jsonb;
begin
  with expected(signature) as (
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
  )
  select coalesce(jsonb_agg(signature order by signature), '[]'::jsonb)
  into v_missing
  from expected
  where to_regprocedure(signature) is null;

  if jsonb_array_length(v_missing) > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Legacy RPC grant-hardening precondition failed; expected functions are missing',
      detail = v_missing::text;
  end if;
end
$precondition$;

revoke execute on function public.backfill_questions_from_ot_generated(text, integer)
  from public, anon, authenticated;
revoke execute on function public.generate_command_mcq_v1(text, integer)
  from public, anon, authenticated;
revoke execute on function public.generate_command_subject_mcq_v1(text, integer)
  from public, anon, authenticated;
revoke execute on function public.generate_numeric_mcq_v1(text, text, integer)
  from public, anon, authenticated;
revoke execute on function public.generate_promise_mcq_v1(integer)
  from public, anon, authenticated;
revoke execute on function public.generate_sequence_adjacent_mcq_v1(text, integer)
  from public, anon, authenticated;
revoke execute on function public.generate_sequence_first_mcq_v1(text, integer)
  from public, anon, authenticated;
revoke execute on function public.generate_sequence_last_mcq_v1(text, integer)
  from public, anon, authenticated;
revoke execute on function public.generate_sequence_order_mcq_v1(text, integer)
  from public, anon, authenticated;
revoke execute on function public.generate_speech_mcq_v1(text, text, integer)
  from public, anon, authenticated;
revoke execute on function public.get_mcq_event_entity_v1(text, integer)
  from public, anon, authenticated;
revoke execute on function public.load_generated_questions(text, text, integer, text, text)
  from public, anon, authenticated;
revoke execute on function public.mcq_pack_v1(text, uuid, text, jsonb, integer)
  from public, anon, authenticated;
revoke execute on function public.update_theta_from_answer_v1(uuid, text, uuid, boolean)
  from public, anon, authenticated;

grant execute on function public.backfill_questions_from_ot_generated(text, integer)
  to service_role;
grant execute on function public.generate_command_mcq_v1(text, integer)
  to service_role;
grant execute on function public.generate_command_subject_mcq_v1(text, integer)
  to service_role;
grant execute on function public.generate_numeric_mcq_v1(text, text, integer)
  to service_role;
grant execute on function public.generate_promise_mcq_v1(integer)
  to service_role;
grant execute on function public.generate_sequence_adjacent_mcq_v1(text, integer)
  to service_role;
grant execute on function public.generate_sequence_first_mcq_v1(text, integer)
  to service_role;
grant execute on function public.generate_sequence_last_mcq_v1(text, integer)
  to service_role;
grant execute on function public.generate_sequence_order_mcq_v1(text, integer)
  to service_role;
grant execute on function public.generate_speech_mcq_v1(text, text, integer)
  to service_role;
grant execute on function public.get_mcq_event_entity_v1(text, integer)
  to service_role;
grant execute on function public.load_generated_questions(text, text, integer, text, text)
  to service_role;
grant execute on function public.mcq_pack_v1(text, uuid, text, jsonb, integer)
  to service_role;
grant execute on function public.update_theta_from_answer_v1(uuid, text, uuid, boolean)
  to service_role;

comment on function public.backfill_questions_from_ot_generated(text, integer) is
  'Legacy OBS generator/load helper. Client execute revoked 2026-08-21; keep service_role temporarily before deletion review.';
comment on function public.generate_command_mcq_v1(text, integer) is
  'Legacy OBS generator/load helper. Client execute revoked 2026-08-21; keep service_role temporarily before deletion review.';
comment on function public.generate_command_subject_mcq_v1(text, integer) is
  'Legacy OBS generator/load helper. Client execute revoked 2026-08-21; keep service_role temporarily before deletion review.';
comment on function public.generate_numeric_mcq_v1(text, text, integer) is
  'Legacy OBS generator/load helper. Client execute revoked 2026-08-21; keep service_role temporarily before deletion review.';
comment on function public.generate_promise_mcq_v1(integer) is
  'Legacy OBS generator/load helper. Client execute revoked 2026-08-21; keep service_role temporarily before deletion review.';
comment on function public.generate_sequence_adjacent_mcq_v1(text, integer) is
  'Legacy OBS generator/load helper. Client execute revoked 2026-08-21; keep service_role temporarily before deletion review.';
comment on function public.generate_sequence_first_mcq_v1(text, integer) is
  'Legacy OBS generator/load helper. Client execute revoked 2026-08-21; keep service_role temporarily before deletion review.';
comment on function public.generate_sequence_last_mcq_v1(text, integer) is
  'Legacy OBS generator/load helper. Client execute revoked 2026-08-21; keep service_role temporarily before deletion review.';
comment on function public.generate_sequence_order_mcq_v1(text, integer) is
  'Legacy OBS generator/load helper. Client execute revoked 2026-08-21; keep service_role temporarily before deletion review.';
comment on function public.generate_speech_mcq_v1(text, text, integer) is
  'Legacy OBS generator/load helper. Client execute revoked 2026-08-21; keep service_role temporarily before deletion review.';
comment on function public.get_mcq_event_entity_v1(text, integer) is
  'Legacy OBS generator/load helper. Client execute revoked 2026-08-21; keep service_role temporarily before deletion review.';
comment on function public.load_generated_questions(text, text, integer, text, text) is
  'Legacy OBS generator/load helper. Client execute revoked 2026-08-21; keep service_role temporarily before deletion review.';
comment on function public.mcq_pack_v1(text, uuid, text, jsonb, integer) is
  'Legacy OBS generator/load helper. Client execute revoked 2026-08-21; keep service_role temporarily before deletion review.';
comment on function public.update_theta_from_answer_v1(uuid, text, uuid, boolean) is
  'Legacy OBS theta helper. Client execute revoked 2026-08-21; current submit chain uses update_theta_internal.';

do $postcondition$
declare
  v_bad_client_grants jsonb;
  v_missing_service_grants jsonb;
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
  )
  select
    coalesce(jsonb_agg(signature order by signature) filter (
      where has_function_privilege('anon', to_regprocedure(signature), 'execute')
        or has_function_privilege('authenticated', to_regprocedure(signature), 'execute')
    ), '[]'::jsonb),
    coalesce(jsonb_agg(signature order by signature) filter (
      where not has_function_privilege('service_role', to_regprocedure(signature), 'execute')
    ), '[]'::jsonb)
  into v_bad_client_grants, v_missing_service_grants
  from hardened;

  if jsonb_array_length(v_bad_client_grants) > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Legacy RPC grant-hardening failed; client execute remains',
      detail = v_bad_client_grants::text;
  end if;

  if jsonb_array_length(v_missing_service_grants) > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Legacy RPC grant-hardening failed; service_role execute missing',
      detail = v_missing_service_grants::text;
  end if;
end
$postcondition$;

notify pgrst, 'reload schema';

commit;
