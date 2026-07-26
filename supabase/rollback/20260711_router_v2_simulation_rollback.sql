begin;

drop function if exists public.obs_simulate_router_v2(uuid, uuid, double precision, integer);

notify pgrst, 'reload schema';

commit;
