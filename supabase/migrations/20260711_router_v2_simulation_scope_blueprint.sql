-- Migration-history marker for the simulator's scope-wide dimension blueprint.
--
-- The final function definition is kept in 20260711_router_v2_simulation.sql so
-- a fresh database receives the corrected implementation in one pass. On the
-- live project this follow-up migration replaced the initial book-local deficit
-- calculation with a scope-wide target/observed-share calculation.

begin;

comment on function public.obs_simulate_router_v2(uuid, uuid, double precision, integer) is
  'Read-only router-v2 simulation using scope-wide dimension targets, theta-matched item information, importance, exposure, and stem-family exclusion.';

commit;
