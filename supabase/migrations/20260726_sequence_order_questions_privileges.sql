-- Restore the persistent OT assessment RPC privilege after sequence support.
-- Supabase anonymous users carry the authenticated role, so public/anon remain
-- excluded while browser-anonymous and registered users can continue attempts.

begin;

revoke all on function public.obs_get_next_ot_assessment_question(uuid)
  from public, anon;

grant execute on function public.obs_get_next_ot_assessment_question(uuid)
  to authenticated, service_role;

grant execute on function public.obs_submit_ot_assessment_response(
  uuid, uuid, text
) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
