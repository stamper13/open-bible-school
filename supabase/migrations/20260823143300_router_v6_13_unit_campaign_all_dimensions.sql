-- Router v6, step 13: unit-level campaigns must include all dimensions.
--
-- A dashboard UNIT recommendation carries dimension_key = null. The v6 campaign
-- candidate query treated that as "only null-dimension questions", which hid
-- real stage-1 foundation probes such as Genesis 12-50's geography item.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $migration$
declare
  v_sql text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql like '%unit-level campaigns include all dimensions%' then
    raise notice 'Router v6 unit-campaign dimension widening is already installed.';
    return;
  end if;

  v_sql := replace(
    v_sql,
$needle$
    join public.obs_question_bank_with_units question
      on question.dimension_key is not distinct from campaign_scope.dimension_key
$needle$,
$replacement$
    join public.obs_question_bank_with_units question
      -- Unit-level campaigns have no dimension target; include every dimension
      -- in the unit so stage-1 foundation probes are eligible.
      on (
        campaign_scope.dimension_key is null
        or question.dimension_key is not distinct from campaign_scope.dimension_key
      )
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
        when base.dimension_key is distinct from campaign_scope.dimension_key
          then null
$needle$,
$replacement$
        when campaign_scope.dimension_key is not null
          and base.dimension_key is distinct from campaign_scope.dimension_key
          then null
$replacement$
  );

  if v_sql = v_original
     or v_sql not like '%unit-level campaigns have no dimension target%'
     or v_sql not like '%campaign_scope.dimension_key is not null%' then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 13 patch did not match the expected ranker body.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.obs_rank_ot_assessment_candidates_v6(uuid, uuid, text, integer, timestamptz, integer) is
  'Mode-aware wrapper over v5. Unit-level campaigns include all question dimensions so missing foundation probes can be served; dashboard foundation gaps are promoted when no campaign is active; cold_start/sweep use a widened v5 pool with dimension debt; campaign mode promotes phase-matching candidates subject to per-attempt caps. STABLE: writes nothing.';

commit;
