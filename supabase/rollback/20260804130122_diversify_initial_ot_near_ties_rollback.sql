-- Restore the exact pre-diversification OT router definition captured by the
-- forward migration.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $rollback$
declare
  v_definition text;
begin
  select backup.definition
  into strict v_definition
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260804130122_diversify_initial_ot_near_ties'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_rank_ot_assessment_candidates_v4'
    and backup.object_type = 'function';

  execute v_definition;
end
$rollback$;

notify pgrst, 'reload schema';

commit;
