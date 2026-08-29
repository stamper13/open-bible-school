-- Conservative rollback placeholder.
--
-- This production migration was applied live before the SQL was mirrored into
-- the repo. To roll it back safely, restore the previous function definitions
-- from the captured production baseline or from obs_schema_backups if present.
-- Do not blindly drop the helper: dashboard and recommendation functions may
-- depend on it once this migration is live.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'Manual rollback required: restore pre-20260823132628 function definitions from baseline/schema backups.';
end
$$;

rollback;
