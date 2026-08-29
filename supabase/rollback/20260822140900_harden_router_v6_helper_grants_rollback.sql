\set ON_ERROR_STOP on

begin;

grant execute on function public.obs_unit_antievidence(uuid)
  to authenticated, service_role;
grant execute on function public.obs_learner_evidence_ledger(uuid)
  to authenticated, service_role;
grant execute on function public.obs_router_mode(uuid)
  to authenticated, service_role;
grant execute on function public.obs_next_campaign_target(uuid)
  to authenticated, service_role;
grant execute on function public.obs_router_sync_campaign(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.obs_rank_ot_assessment_candidates_v6(
  uuid, uuid, text, integer, timestamptz, integer
) to authenticated, service_role;
grant execute on function public.obs_mark_unit_reread(uuid, text, text)
  to authenticated, service_role;

commit;
