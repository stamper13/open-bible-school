begin;

do $$
declare
  v_function text;
  v_attempt_id uuid;
  v_user_id uuid;
  v_failures jsonb;
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_function;

  select attempt.id, attempt.user_id
  into v_attempt_id, v_user_id
  from public.assessment_attempts attempt
  where upper(coalesce(attempt.testament, 'OT')) = 'OT'
  order by attempt.created_at desc
  limit 1;

  with checks(name, ok) as (
    values
      (
        'post-150 attempt section cap is installed',
        coalesce(v_function, '') like '%post-150 attempt section cap%'
      ),
      (
        'attempt cap penalty is stronger than previous cap',
        coalesce(v_function, '') like '%then 10%'
      ),
      (
        'supplemental under-floor dimension exception remains',
        coalesce(v_function, '') like '%reasoned.selection_lane = ''V7_LOW_EVIDENCE_SUPPLEMENTAL''%'
      ),
      (
        'supplemental candidate source remains installed',
        coalesce(v_function, '') like '%V7_LOW_EVIDENCE_SUPPLEMENTAL%'
      ),
      (
        'live next-question RPC still does not call V7',
        coalesce(pg_get_functiondef('public.obs_get_next_ot_assessment_question(uuid)'::regprocedure), '')
          not like '%obs_rank_ot_assessment_candidates_v7%'
      ),
      (
        'displayed BLI still does not use V7 ladder metadata',
        coalesce(pg_get_functiondef('public.obs_get_bli_scores_v2(uuid)'::regprocedure), '')
          not like '%obs_question_ladder_metadata%'
      ),
      (
        'V7 still returns renderable candidates for existing OT state',
        v_attempt_id is null
        or exists (
          select 1
          from public.obs_rank_ot_assessment_candidates_v7(
            v_attempt_id,
            v_user_id,
            'V7_SHADOW',
            null,
            now(),
            10
          ) ranked
          where ranked.payload ? 'choices'
            and ranked.payload ? 'correct_choice_id'
            and ranked.book_code is not null
            and ranked.dimension_key is not null
        )
      )
  )
  select coalesce(jsonb_agg(name order by name) filter (where not ok), '[]'::jsonb)
  into v_failures
  from checks;

  if jsonb_array_length(v_failures) > 0 then
    raise exception 'FAIL: V7 attempt section cap tuning verification failed: %', v_failures;
  end if;
end;
$$;

rollback;
