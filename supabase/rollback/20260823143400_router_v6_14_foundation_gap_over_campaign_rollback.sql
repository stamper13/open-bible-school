-- Restores the pre-step-14 foundation-gap campaign exclusion.

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
    where question.payload ? 'choices'
$new$,
$old$
    where not exists (select 1 from campaign_scope)
      and question.payload ? 'choices'
$old$
  );

  execute v_sql;
end
$rollback$;

commit;
