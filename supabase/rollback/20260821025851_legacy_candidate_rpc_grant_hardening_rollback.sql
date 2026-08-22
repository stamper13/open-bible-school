begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

grant execute on function public.backfill_questions_from_ot_generated(text, integer)
  to public, anon, authenticated, service_role;
grant execute on function public.generate_command_mcq_v1(text, integer)
  to public, anon, authenticated, service_role;
grant execute on function public.generate_command_subject_mcq_v1(text, integer)
  to public, anon, authenticated, service_role;
grant execute on function public.generate_numeric_mcq_v1(text, text, integer)
  to public, anon, authenticated, service_role;
grant execute on function public.generate_promise_mcq_v1(integer)
  to public, anon, authenticated, service_role;
grant execute on function public.generate_sequence_adjacent_mcq_v1(text, integer)
  to public, anon, authenticated, service_role;
grant execute on function public.generate_sequence_first_mcq_v1(text, integer)
  to public, anon, authenticated, service_role;
grant execute on function public.generate_sequence_last_mcq_v1(text, integer)
  to public, anon, authenticated, service_role;
grant execute on function public.generate_sequence_order_mcq_v1(text, integer)
  to public, anon, authenticated, service_role;
grant execute on function public.generate_speech_mcq_v1(text, text, integer)
  to public, anon, authenticated, service_role;
grant execute on function public.get_mcq_event_entity_v1(text, integer)
  to public, anon, authenticated, service_role;
grant execute on function public.load_generated_questions(text, text, integer, text, text)
  to public, anon, authenticated, service_role;
grant execute on function public.mcq_pack_v1(text, uuid, text, jsonb, integer)
  to public, anon, authenticated, service_role;
grant execute on function public.update_theta_from_answer_v1(uuid, text, uuid, boolean)
  to public, anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
