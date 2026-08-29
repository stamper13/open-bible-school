begin;

do $$
declare
  v_function text;
  v_failures jsonb;
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_function;

  with checks(name, ok) as (
    values
      (
        'V7 ranker exists',
        v_function is not null
      ),
      (
        'LOW_EVIDENCE_FLOOR remains installed',
        coalesce(v_function, '') like '%LOW_EVIDENCE_FLOOR%'
      ),
      (
        'low-evidence floor uses long-run totals',
        coalesce(v_function, '') like '%(select scoring_answered from long_run_totals) >= 80%'
      ),
      (
        'low-evidence floor no longer uses current attempt totals',
        coalesce(v_function, '') not like '%(select scoring_answered from answer_totals) >= 80%'
      ),
      (
        'long-run threshold marker is installed',
        coalesce(v_function, '') like '%long-run low-evidence floor threshold%'
      ),
      (
        'early section balance remains installed',
        coalesce(v_function, '') like '%early attempt section brake%'
      ),
      (
        'live next-question RPC still does not call V7',
        coalesce(pg_get_functiondef('public.obs_get_next_ot_assessment_question(uuid)'::regprocedure), '')
          not like '%obs_rank_ot_assessment_candidates_v7%'
      ),
      (
        'displayed BLI still does not call V7',
        coalesce(pg_get_functiondef('public.obs_get_bli_scores_v2(uuid)'::regprocedure), '')
          not like '%obs_rank_ot_assessment_candidates_v7%'
        and coalesce(pg_get_functiondef('public.obs_get_bli_scores_v2(uuid)'::regprocedure), '')
          not like '%obs_question_ladder_metadata%'
      )
  )
  select coalesce(jsonb_agg(name order by name) filter (where not ok), '[]'::jsonb)
  into v_failures
  from checks;

  if jsonb_array_length(v_failures) > 0 then
    raise exception 'FAIL: V7 low-evidence floor long-run verification failed: %', v_failures;
  end if;
end;
$$;

rollback;
