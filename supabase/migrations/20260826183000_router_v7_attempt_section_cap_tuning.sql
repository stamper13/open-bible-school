-- V7 shadow: tune attempt-level section cap.
--
-- The supplemental source improved law coverage, but Latter Prophets still
-- spiked inside attempts. The previous post-200 attempt cap was too
-- conservative: it required 200 long-run answers and 80 section answers before
-- it could help. This keeps V7 shadow-only and changes no app-facing RPC.

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
      message = 'Router V7 attempt section cap prerequisites are missing; no changes made.';
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
  '20260826183000_router_v7_attempt_section_cap_tuning',
  'public',
  'obs_rank_ot_assessment_candidates_v7',
  'function',
  pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260826183000_router_v7_attempt_section_cap_tuning'
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

  if v_sql like '%post-150 attempt section cap%' then
    raise notice 'Router V7 attempt section cap tuning is already installed.';
    return;
  end if;

  if v_sql not like '%V7_LOW_EVIDENCE_SUPPLEMENTAL%'
     or v_sql not like '%post-200 attempt section cap%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Expected V7 supplemental source/cap prerequisites are not installed.';
  end if;

  v_sql := replace(
    v_sql,
$needle$
        case
          when (select scoring_answered from long_run_totals) >= 200
            and enriched.v7_section_answered >= 80
            and enriched.v7_attempt_section_share > greatest(0.32, enriched.v7_section_target_share + 0.06)
            then 'post-200 attempt section cap'
        end,
$needle$,
$replacement$
        case
          when (select scoring_answered from long_run_totals) >= 150
            and enriched.v7_section_answered >= 60
            and enriched.v7_attempt_section_share > greatest(0.32, enriched.v7_section_target_share + 0.06)
            and not (
              enriched.selection_lane = 'V7_LOW_EVIDENCE_SUPPLEMENTAL'
              and enriched.v7_dimension_answered < case
                when (select scoring_answered from long_run_totals) >= 200 then 50
                else 20
              end
            )
            then 'post-150 attempt section cap'
        end,
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
          case
            when (select scoring_answered from long_run_totals) >= 200
              and reasoned.v7_lane <> 'LOW_EVIDENCE_FLOOR'
              and reasoned.v7_section_answered >= 80
              and reasoned.v7_attempt_section_share > greatest(0.32, reasoned.v7_section_target_share + 0.06)
              then 8
            else 0
          end,
$needle$,
$replacement$
          case
            when (select scoring_answered from long_run_totals) >= 150
              and reasoned.v7_section_answered >= 60
              and reasoned.v7_attempt_section_share > greatest(0.32, reasoned.v7_section_target_share + 0.06)
              and not (
                reasoned.selection_lane = 'V7_LOW_EVIDENCE_SUPPLEMENTAL'
                and reasoned.v7_dimension_answered < case
                  when (select scoring_answered from long_run_totals) >= 200 then 50
                  else 20
                end
              )
              then 10
            else 0
          end,
$replacement$
  );

  if v_sql = v_original then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 attempt section cap patch did not match the expected function body.';
  end if;

  if v_sql not like '%post-150 attempt section cap%'
     or v_sql not like '%then 10%'
     or v_sql not like '%reasoned.selection_lane = ''V7_LOW_EVIDENCE_SUPPLEMENTAL''%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 attempt section cap markers missing after patch.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.obs_rank_ot_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
) is
  'Shadow-only V7 OT candidate ranker. Adds supplemental low-evidence candidates and tuned post-150 attempt-section caps. STABLE: writes nothing.';

commit;
