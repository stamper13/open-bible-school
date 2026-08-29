-- Restore the exact pre-step-20 v6 ranker body captured by the forward
-- migration. This leaves policy activation and scoring functions untouched.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback$
declare
  v_sql text;
begin
  select backup.definition
  into v_sql
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260823170000_router_v6_20_history_aware_long_run_brakes'
    and backup.object_name = 'obs_rank_ot_assessment_candidates_v6'
  order by backup.created_at desc
  limit 1;

  if v_sql is null then
    raise exception using
      errcode = 'P0001',
      message = 'Missing backup for router v6 step 20 rollback.';
  end if;

  execute v_sql;
end
$rollback$;

comment on function public.obs_rank_ot_assessment_candidates_v6(uuid, uuid, text, integer, timestamptz, integer) is
  'Mode-aware wrapper over v5. Treats campaign mode without an open campaign as ordinary reranking, excludes unsupported order-response questions, caps repeated section screens per attempt, demotes chapter-addressed high-specificity campaign items, and promotes phase-matching campaign evidence subject to per-attempt caps. STABLE: writes nothing.';

notify pgrst, 'reload schema';

commit;
