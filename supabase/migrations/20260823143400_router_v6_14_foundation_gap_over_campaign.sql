-- Router v6, step 14: dashboard foundation gaps outrank open campaigns.
--
-- Campaign sync may open a dimension-specific reread campaign for the same
-- unit. If the dashboard/ladder says the unit is still missing foundation
-- evidence, the unanswered stage-1 item must be eligible anyway.

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

  v_sql := replace(
    v_sql,
$needle$
    where not exists (select 1 from campaign_scope)
      and question.payload ? 'choices'
$needle$,
$replacement$
    where question.payload ? 'choices'
$replacement$
  );

  if v_sql = v_original
     or v_sql like '%where not exists (select 1 from campaign_scope)%' then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 14 patch did not remove the campaign exclusion.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.obs_rank_ot_assessment_candidates_v6(uuid, uuid, text, integer, timestamptz, integer) is
  'Mode-aware wrapper over v5. Dashboard foundation gaps outrank open campaigns so missing stage-1 evidence is served even if campaign sync opened a dimension-specific reread campaign; cold_start/sweep use a widened v5 pool with dimension debt; campaign mode promotes phase-matching candidates subject to per-attempt caps. STABLE: writes nothing.';

commit;
