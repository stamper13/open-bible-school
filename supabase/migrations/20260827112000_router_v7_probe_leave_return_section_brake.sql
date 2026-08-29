-- V7 active tuning: probe, leave, return section brake.
--
-- Live testing showed V7 correctly identified a weak Latter Prophets pocket,
-- but then kept sampling that section too heavily inside a short assessment.
-- This keeps the V7 philosophy while adding an earlier attempt-level brake:
-- after a section has supplied a few answers and is already over its target
-- share, even weak-area / low-evidence candidates are deferred so the router
-- can sample elsewhere and return later.

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
      message = 'Router V7 probe-leave-return prerequisites are missing; no changes made.';
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
  '20260827112000_router_v7_probe_leave_return_section_brake',
  'public',
  'obs_rank_ot_assessment_candidates_v7',
  'function',
  pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260827112000_router_v7_probe_leave_return_section_brake'
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

  if v_sql like '%probe-leave-return section brake%' then
    raise notice 'Router V7 probe-leave-return section brake is already installed.';
    return;
  end if;

  if v_sql not like '%V7_LOW_EVIDENCE_SUPPLEMENTAL%'
     or v_sql not like '%post-150 attempt section cap%'
     or v_sql not like '%early attempt section brake%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Expected V7 supplemental / post-150 cap prerequisites are not installed; apply prior V7 tuning migrations first.';
  end if;

  v_sql := replace(
    v_sql,
$needle$
        case
          when (select scoring_answered from answer_totals) between 8 and 29
            and enriched.v7_attempt_section_share > greatest(0.40, enriched.v7_section_target_share + 0.10)
            then 'early attempt section brake'
        end,
$needle$,
$replacement$
        case
          when (select scoring_answered from answer_totals) between 8 and 29
            and enriched.v7_attempt_section_share > greatest(0.40, enriched.v7_section_target_share + 0.10)
            then 'early attempt section brake'
        end,
        case
          when (select scoring_answered from answer_totals) between 8 and 39
            and (select scoring_answered from answer_totals) * enriched.v7_attempt_section_share >= 3
            and enriched.v7_attempt_section_share > greatest(0.35, enriched.v7_section_target_share + 0.08)
            and enriched.v7_lane in ('WEAK_AREA_EVIDENCE', 'LOW_EVIDENCE_FLOOR')
            then 'probe-leave-return section brake'
        end,
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
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
            when (select scoring_answered from answer_totals) between 8 and 39
              and (select scoring_answered from answer_totals) * reasoned.v7_attempt_section_share >= 3
              and reasoned.v7_attempt_section_share
                > greatest(0.35, reasoned.v7_section_target_share + 0.08)
              and reasoned.v7_lane in ('WEAK_AREA_EVIDENCE', 'LOW_EVIDENCE_FLOOR')
              then 2
            else 0
          end,
          case
            when reasoned.v7_long_run_section_share
$replacement$
  );

  if v_sql = v_original then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 probe-leave-return patch did not match the expected function body.';
  end if;

  if v_sql not like '%probe-leave-return section brake%'
     or v_sql not like '%reasoned.v7_lane in (''WEAK_AREA_EVIDENCE'', ''LOW_EVIDENCE_FLOOR'')%'
     or v_sql not like '%between 8 and 39%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 probe-leave-return markers missing after patch.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.obs_rank_ot_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
) is
  'Active V7 OT candidate ranker. Adds supplemental low-evidence candidates, tuned post-150 attempt-section caps, and a probe-leave-return brake so weak sections are sampled then deferred within short assessments.';

commit;
