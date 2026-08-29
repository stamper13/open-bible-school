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
        'V7 ranker exists',
        v_function is not null
      ),
      (
        'early attempt section brake marker is installed',
        coalesce(v_function, '') like '%early attempt section brake%'
      ),
      (
        'early brake preserves weak-area evidence override',
        coalesce(v_function, '') like '%v7_lane <> ''WEAK_AREA_EVIDENCE''%'
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
      ),
      (
        'top V7 pick is not blocked while a broader candidate exists',
        v_attempt_id is null
        or not exists (
          with ranked as (
            select *
            from public.obs_rank_ot_assessment_candidates_v7(
              v_attempt_id,
              v_user_id,
              'V7_SHADOW',
              null,
              now(),
              50
            )
          )
          select 1
          from ranked top_pick
          where top_pick.candidate_rank = 1
            and top_pick.v7_parent_gate = 'blocked_no_parent_evidence'
            and exists (
              select 1
              from ranked alternative
              where alternative.v7_parent_gate <> 'blocked_no_parent_evidence'
            )
        )
      )
  )
  select coalesce(jsonb_agg(name order by name) filter (where not ok), '[]'::jsonb)
  into v_failures
  from checks;

  if jsonb_array_length(v_failures) > 0 then
    raise exception 'FAIL: V7 early section balance verification failed: %', v_failures;
  end if;
end;
$$;

rollback;
