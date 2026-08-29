begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  v_ranker text;
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_ranker;

  if v_ranker not like '%empty campaign mode falls back to ordinary reranking%'
     or v_ranker not like '%cap broad section screens once this sitting already has three%' then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: v6 ranker is missing empty-campaign fallback or broad section-screen cap.';
  end if;
end
$$;

rollback;
