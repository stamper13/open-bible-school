-- V7 shadow: make the late low-evidence floor use long-run answer totals.
--
-- The first 500-question replay attempt found that LOW_EVIDENCE_FLOOR never
-- fired across normal 50-question attempts because the threshold checked the
-- current attempt count (`answer_totals`) instead of accumulated learner
-- history (`long_run_totals`). This keeps V7 shadow-only and changes no
-- app-facing RPC.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regprocedure(
       'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'
     ) is null
     or to_regclass('public.obs_schema_backups') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 low-evidence floor long-run prerequisites are missing; no changes made.';
  end if;
end
$$;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260826140228_router_v7_low_evidence_floor_long_run_total',
  'public',
  'obs_rank_ot_assessment_candidates_v7',
  'function',
  pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260826140228_router_v7_low_evidence_floor_long_run_total'
    and backup.object_name = 'obs_rank_ot_assessment_candidates_v7'
);

do $migration$
declare
  v_sql text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql like '%long-run low-evidence floor threshold%' then
    raise notice 'Router V7 low-evidence floor already uses long-run totals.';
    return;
  end if;

  if v_sql not like '%LOW_EVIDENCE_FLOOR%' then
    raise exception using
      errcode = 'P0001',
      message = 'LOW_EVIDENCE_FLOOR is not installed; apply the prior guardrail first.';
  end if;

  v_sql := replace(
    v_sql,
    '(select scoring_answered from answer_totals) >= 80',
    '(select scoring_answered from long_run_totals) >= 80'
  );

  v_sql := replace(
    v_sql,
    'late low-evidence floor',
    'late low-evidence floor; long-run low-evidence floor threshold'
  );

  if v_sql = v_original then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 low-evidence floor long-run patch did not match the expected function body.';
  end if;

  if v_sql like '%(select scoring_answered from answer_totals) >= 80%'
     or v_sql not like '%(select scoring_answered from long_run_totals) >= 80%'
     or v_sql not like '%long-run low-evidence floor threshold%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 low-evidence floor long-run marker missing after patch.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.obs_rank_ot_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
) is
  'Shadow-only V7 OT candidate ranker. Reranks a widened V6 pool with ladder metadata, parent-scope evidence, novelty suppression, section/dimension share brakes, early attempt section balance, and late low-evidence floors using long-run answer totals. STABLE: writes nothing.';

commit;
