-- Restores the pre-step-13 campaign dimension filter.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback$
declare
  v_sql text;
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_sql;

  v_sql := replace(
    v_sql,
$new$
    join public.obs_question_bank_with_units question
      on (
        campaign_scope.dimension_key is null
        or question.dimension_key is not distinct from campaign_scope.dimension_key
      )
$new$,
$old$
    join public.obs_question_bank_with_units question
      on question.dimension_key is not distinct from campaign_scope.dimension_key
$old$
  );

  v_sql := replace(
    v_sql,
$new$
        when campaign_scope.dimension_key is not null
          and base.dimension_key is distinct from campaign_scope.dimension_key
          then null
$new$,
$old$
        when base.dimension_key is distinct from campaign_scope.dimension_key
          then null
$old$
  );

  execute v_sql;
end
$rollback$;

commit;
