-- V7 shadow: longer-run evidence floors and stronger late section brakes.
--
-- The 500-question V7 counterfactual replay showed that the section floor
-- helped Writings, but LOW_EVIDENCE_FLOOR plateaued after about 300 questions
-- and Latter Prophets climbed to 193/500. This keeps V7 shadow-only and
-- changes no app-facing RPC.

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
      message = 'Router V7 long-run floor/brake prerequisites are missing; no changes made.';
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
  '20260826143400_router_v7_long_run_floor_and_section_brake',
  'public',
  'obs_rank_ot_assessment_candidates_v7',
  'function',
  pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260826143400_router_v7_long_run_floor_and_section_brake'
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

  if v_sql like '%late long-run section brake%' then
    raise notice 'Router V7 long-run floor/brake patch is already installed.';
    return;
  end if;

  if v_sql not like '%LOW_EVIDENCE_FLOOR%'
     or v_sql not like '%long-run low-evidence floor threshold%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'LOW_EVIDENCE_FLOOR with long-run threshold is not installed; apply prior V7 guardrails first.';
  end if;

  v_sql := replace(
    v_sql,
$needle$
        when (select scoring_answered from long_run_totals) >= 80
          and enriched.v7_depth_stage <= 3
          and (
            enriched.v7_section_answered < 40
            or enriched.v7_dimension_answered < 20
          ) then 'LOW_EVIDENCE_FLOOR'
$needle$,
$replacement$
        when (select scoring_answered from long_run_totals) >= 80
          and enriched.v7_depth_stage <= 3
          and (
            enriched.v7_section_answered < case
              when (select scoring_answered from long_run_totals) >= 200 then 80
              else 40
            end
            or enriched.v7_dimension_answered < case
              when (select scoring_answered from long_run_totals) >= 200 then 50
              else 20
            end
          ) then 'LOW_EVIDENCE_FLOOR'
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
          when (select scoring_answered from long_run_totals) >= 80
            and enriched.v7_depth_stage <= 3
            and (
              enriched.v7_section_answered < 40
              or enriched.v7_dimension_answered < 20
            ) then 'late low-evidence floor; long-run low-evidence floor threshold'
        end,
$needle$,
$replacement$
          when (select scoring_answered from long_run_totals) >= 80
            and enriched.v7_depth_stage <= 3
            and (
              enriched.v7_section_answered < case
                when (select scoring_answered from long_run_totals) >= 200 then 80
                else 40
              end
              or enriched.v7_dimension_answered < case
                when (select scoring_answered from long_run_totals) >= 200 then 50
                else 20
              end
            ) then 'late low-evidence floor; long-run low-evidence floor threshold'
        end,
        case
          when (select scoring_answered from long_run_totals) >= 200
            and enriched.v7_long_run_section_share
              > greatest(enriched.v7_section_target_share + 0.05, enriched.v7_section_target_share * 1.18)
            then 'late long-run section brake'
        end,
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
          case
            when (select scoring_answered from long_run_totals) >= 80
              and reasoned.v7_depth_stage <= 3
              and (
                reasoned.v7_section_answered < 40
                or reasoned.v7_dimension_answered < 20
              ) then 0
            else 1
          end,
          case
            when (select scoring_answered from long_run_totals) >= 80
              then -(
                greatest(0, 40 - reasoned.v7_section_answered) * 2
                + greatest(0, 20 - reasoned.v7_dimension_answered)
              )
            else 0
          end,
$needle$,
$replacement$
          case
            when (select scoring_answered from long_run_totals) >= 80
              and reasoned.v7_depth_stage <= 3
              and (
                reasoned.v7_section_answered < case
                  when (select scoring_answered from long_run_totals) >= 200 then 80
                  else 40
                end
                or reasoned.v7_dimension_answered < case
                  when (select scoring_answered from long_run_totals) >= 200 then 50
                  else 20
                end
              ) then 0
            else 1
          end,
          case
            when (select scoring_answered from long_run_totals) >= 80
              then -(
                greatest(
                  0,
                  (case when (select scoring_answered from long_run_totals) >= 200 then 80 else 40 end)
                    - reasoned.v7_section_answered
                ) * 2
                + greatest(
                  0,
                  (case when (select scoring_answered from long_run_totals) >= 200 then 50 else 20 end)
                    - reasoned.v7_dimension_answered
                )
              )
            else 0
          end,
          case
            when (select scoring_answered from long_run_totals) >= 200
              and reasoned.v7_lane <> 'LOW_EVIDENCE_FLOOR'
              and reasoned.v7_long_run_section_share
                > greatest(reasoned.v7_section_target_share + 0.05, reasoned.v7_section_target_share * 1.18)
              then 3
            else 0
          end,
$replacement$
  );

  if v_sql = v_original then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 long-run floor/brake patch did not match the expected function body.';
  end if;

  if v_sql not like '%late long-run section brake%'
     or v_sql not like '%then 80 else 40%'
     or v_sql not like '%then 50 else 20%'
     or v_sql not like '%reasoned.v7_lane <> ''LOW_EVIDENCE_FLOOR''%'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 long-run floor/brake markers missing after patch.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.obs_rank_ot_assessment_candidates_v7(
  uuid, uuid, text, integer, timestamptz, integer
) is
  'Shadow-only V7 OT candidate ranker. Adds extended long-run evidence floors and late section-share brakes after the initial V7 low-evidence and early-balance passes. STABLE: writes nothing.';

commit;
