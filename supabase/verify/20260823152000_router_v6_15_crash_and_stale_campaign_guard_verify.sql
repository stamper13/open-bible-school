begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  v_fast text;
  v_ranker text;
  v_sync text;
begin
  select pg_get_functiondef(
    'public.obs_get_next_ot_baseline_question_fast(uuid,uuid)'::regprocedure
  )
  into v_fast;

  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_ranker;

  select pg_get_functiondef(
    'public.obs_router_sync_campaign(uuid,uuid)'::regprocedure
  )
  into v_sync;

  if v_fast not like '%unsupported order response questions excluded from MCQ selector%'
     or v_fast like '%jsonb_array_length(question.payload->''choices'') between 3 and 5%' then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: fast OT selector can still admit unsupported order-response questions.';
  end if;

  if v_ranker not like '%unsupported order response questions excluded before v6 ranking%'
     or v_ranker not like '%obs_is_high_specificity_assessment_question(%' then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: v6 ranker is missing order exclusion or chapter-addressed demotion.';
  end if;

  if v_sync not like '%resolved_ladder_sufficient%' then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: campaign sync is missing stale ladder-sufficient closure.';
  end if;
end
$$;

rollback;
