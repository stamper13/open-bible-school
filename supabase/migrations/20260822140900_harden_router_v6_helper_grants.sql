-- Harden Router v6 helper grants.
--
-- Most v6 helpers are internal SECURITY DEFINER functions used by the
-- authenticated question RPC. They should not be client-callable directly.
-- The one intentional client-facing v6 helper is obs_mark_unit_reread, used
-- by the dashboard reread confirmation, and it remains authenticated-only.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

revoke all on function public.obs_unit_antievidence(uuid)
  from public, anon, authenticated;
grant execute on function public.obs_unit_antievidence(uuid)
  to service_role;

revoke all on function public.obs_learner_evidence_ledger(uuid)
  from public, anon, authenticated;
grant execute on function public.obs_learner_evidence_ledger(uuid)
  to service_role;

revoke all on function public.obs_router_mode(uuid)
  from public, anon, authenticated;
grant execute on function public.obs_router_mode(uuid)
  to service_role;

revoke all on function public.obs_next_campaign_target(uuid)
  from public, anon, authenticated;
grant execute on function public.obs_next_campaign_target(uuid)
  to service_role;

revoke all on function public.obs_router_sync_campaign(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.obs_router_sync_campaign(uuid, uuid)
  to service_role;

revoke all on function public.obs_rank_ot_assessment_candidates_v6(
  uuid, uuid, text, integer, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.obs_rank_ot_assessment_candidates_v6(
  uuid, uuid, text, integer, timestamptz, integer
) to service_role;

revoke all on function public.obs_mark_unit_reread(uuid, text, text)
  from public, anon;
grant execute on function public.obs_mark_unit_reread(uuid, text, text)
  to authenticated, service_role;

commit;
