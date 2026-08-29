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

  if v_ranker not like '%cap repeated section-taxonomy screens inside one assessment%' then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: v6 ranker is missing the section-taxonomy repeat cap.';
  end if;
end
$$;

rollback;
