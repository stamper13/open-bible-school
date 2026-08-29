-- V7 shadow: early attempt section balance.
--
-- The compact V6-vs-V7 counterfactual profile replay showed that V7's
-- long-run section brake was too slow for short first-assessment behavior:
-- several 20-question V7 counterfactual runs gave Latter Prophets 9-11 items.
--
-- This keeps V7 shadow-only and changes no app-facing RPC. It adds an early
-- attempt-level section brake for ordinary candidates after the broad-open
-- floor starts producing local evidence. Weak-area evidence is allowed through.

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
      message = 'Router V7 early section balance prerequisites are missing; no changes made.';
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
  '20260826031552_router_v7_early_section_balance',
  'public',
  'obs_rank_ot_assessment_candidates_v7',
  'function',
  pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260826031552_router_v7_early_section_balance'
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

  if v_sql like '%early attempt section brake%' then
    raise notice 'Router V7 early attempt section balance is already installed.';
    return;
  end if;

  v_sql := replace(
    v_sql,
$needle$
        case when enriched.v7_review_status in ('needs_review', 'flagged') then 'metadata review status demoted' end,
        case when enriched.v7_long_run_section_share > greatest(enriched.v7_section_target_share + 0.08, enriched.v7_section_target_share * 1.25) then 'section share brake' end,
$needle$,
$replacement$
        case when enriched.v7_review_status in ('needs_review', 'flagged') then 'metadata review status demoted' end,
        case
          when (select scoring_answered from answer_totals) between 8 and 29
            and enriched.v7_attempt_section_share > greatest(0.40, enriched.v7_section_target_share + 0.10)
            then 'early attempt section brake'
        end,
        case when enriched.v7_long_run_section_share > greatest(enriched.v7_section_target_share + 0.08, enriched.v7_section_target_share * 1.25) then 'section share brake' end,
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
          case
            when reasoned.v7_long_run_section_share
              > greatest(reasoned.v7_section_target_share + 0.08, reasoned.v7_section_target_share * 1.25)
              then 1
            else 0
          end,
          case
            when reasoned.v7_long_run_dimension_share
$needle$,
$replacement$
          case
            when (select scoring_answered from answer_totals) between 8 and 29
              and reasoned.v7_lane <> 'WEAK_AREA_EVIDENCE'
              and reasoned.v7_attempt_section_share
                > greatest(0.40, reasoned.v7_section_target_share + 0.10)
              then 1
            else 0
          end,
          case
            when reasoned.v7_long_run_section_share
              > greatest(reasoned.v7_section_target_share + 0.08, reasoned.v7_section_target_share * 1.25)
              then 1
            else 0
          end,
          case
            when reasoned.v7_long_run_dimension_share
$replacement$
  );

  if v_sql = v_original then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 early section balance patch did not match the expected function body.';
  end if;

  if v_sql not like '%early attempt section brake%' then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 early section balance marker missing after patch.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.obs_rank_ot_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
) is
  'Shadow-only V7 OT candidate ranker. Reranks a widened V6 pool with ladder metadata, parent-scope evidence, novelty suppression, section/dimension share brakes, and early attempt section balance. STABLE: writes nothing.';

commit;
