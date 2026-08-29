-- V7 shadow: late low-evidence floor.
--
-- The 200-question V7 counterfactual replay after early section balance showed
-- good anti-repeat, chapter demotion, and section balance behavior, but two
-- important evidence buckets remained under target:
--
-- - Writings section: 35 served, target floor 40.
-- - law_commands dimension: 15 served, target floor 20.
--
-- This keeps V7 shadow-only and changes no app-facing RPC. It adds a late-run
-- evidence floor lane for broad/mid candidates in under-evidenced sections or
-- dimensions once enough answers exist for a meaningful long-run diagnosis.

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
      message = 'Router V7 late low-evidence floor prerequisites are missing; no changes made.';
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
  '20260826034112_router_v7_late_low_evidence_floor',
  'public',
  'obs_rank_ot_assessment_candidates_v7',
  'function',
  pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260826034112_router_v7_late_low_evidence_floor'
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

  if v_sql like '%LOW_EVIDENCE_FLOOR%' then
    raise notice 'Router V7 late low-evidence floor is already installed.';
    return;
  end if;

  v_sql := replace(
    v_sql,
$needle$
        when (select scoring_answered from answer_totals) < 8
          and enriched.v7_depth_stage <= 2 then 'BROAD_OPEN'
        when (
            enriched.v7_section_answered >= 3
$needle$,
$replacement$
        when (select scoring_answered from answer_totals) < 8
          and enriched.v7_depth_stage <= 2 then 'BROAD_OPEN'
        when (select scoring_answered from answer_totals) >= 80
          and enriched.v7_depth_stage <= 3
          and (
            enriched.v7_section_answered < 40
            or enriched.v7_dimension_answered < 20
          ) then 'LOW_EVIDENCE_FLOOR'
        when (
            enriched.v7_section_answered >= 3
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
        case when enriched.v7_exact_chapter_recall_required then 'exact chapter recall demoted' end,
        case when enriched.v7_review_status in ('needs_review', 'flagged') then 'metadata review status demoted' end,
        case
          when (select scoring_answered from answer_totals) between 8 and 29
$needle$,
$replacement$
        case when enriched.v7_exact_chapter_recall_required then 'exact chapter recall demoted' end,
        case when enriched.v7_review_status in ('needs_review', 'flagged') then 'metadata review status demoted' end,
        case
          when (select scoring_answered from answer_totals) >= 80
            and enriched.v7_depth_stage <= 3
            and (
              enriched.v7_section_answered < 40
              or enriched.v7_dimension_answered < 20
            ) then 'late low-evidence floor'
        end,
        case
          when (select scoring_answered from answer_totals) between 8 and 29
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
          case
            when reasoned.v7_has_recent_narrow_miss
              and reasoned.v7_depth_stage <= 3 then 0
            when reasoned.v7_has_recent_narrow_miss
              and reasoned.v7_depth_stage >= 4 then 2
            else 1
          end,
          case
            when (select scoring_answered from answer_totals) between 8 and 29
$needle$,
$replacement$
          case
            when reasoned.v7_has_recent_narrow_miss
              and reasoned.v7_depth_stage <= 3 then 0
            when reasoned.v7_has_recent_narrow_miss
              and reasoned.v7_depth_stage >= 4 then 2
            else 1
          end,
          case
            when (select scoring_answered from answer_totals) >= 80
              and reasoned.v7_depth_stage <= 3
              and (
                reasoned.v7_section_answered < 40
                or reasoned.v7_dimension_answered < 20
              ) then 0
            else 1
          end,
          case
            when (select scoring_answered from answer_totals) >= 80
              then -(
                greatest(0, 40 - reasoned.v7_section_answered) * 2
                + greatest(0, 20 - reasoned.v7_dimension_answered)
              )
            else 0
          end,
          case
            when (select scoring_answered from answer_totals) between 8 and 29
$replacement$
  );

  if v_sql = v_original then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 late low-evidence floor patch did not match the expected function body.';
  end if;

  if v_sql not like '%LOW_EVIDENCE_FLOOR%'
     or v_sql not like '%late low-evidence floor%'
     or v_sql not like '%greatest(0, 40 - reasoned.v7_section_answered) * 2%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 late low-evidence floor marker missing after patch.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.obs_rank_ot_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
) is
  'Shadow-only V7 OT candidate ranker. Reranks a widened V6 pool with ladder metadata, parent-scope evidence, novelty suppression, section/dimension share brakes, early attempt section balance, and late low-evidence floors. STABLE: writes nothing.';

commit;
