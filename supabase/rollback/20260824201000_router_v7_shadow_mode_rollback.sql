begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

drop function if exists public.obs_log_ot_assessment_v7_shadow_selection(
  uuid, uuid, uuid, text, timestamptz
);

drop function if exists public.obs_rank_ot_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
);

drop table if exists public.obs_router_v7_shadow_log;

notify pgrst, 'reload schema';

commit;
