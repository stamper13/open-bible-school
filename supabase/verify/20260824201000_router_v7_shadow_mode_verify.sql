begin;

do $$
declare
  v_attempt_id uuid;
  v_user_id uuid;
  v_attempts_before bigint;
  v_answers_before bigint;
  v_shadow_logs_before bigint;
  v_shadow_question_id uuid;
  v_failures jsonb;
begin
  select attempt.id, attempt.user_id
  into v_attempt_id, v_user_id
  from public.assessment_attempts attempt
  where upper(coalesce(attempt.testament, 'OT')) = 'OT'
  order by attempt.created_at desc
  limit 1;

  select count(*) into v_attempts_before from public.assessment_attempts;
  select count(*) into v_answers_before from public.assessment_answers;
  select count(*) into v_shadow_logs_before from public.obs_router_v7_shadow_log;

  if v_attempt_id is not null then
    perform 1
    from public.obs_rank_ot_assessment_candidates_v7(
      v_attempt_id,
      v_user_id,
      'V7_SHADOW',
      null,
      now(),
      10
    )
    limit 1;

    select public.obs_log_ot_assessment_v7_shadow_selection(
      v_attempt_id,
      v_user_id,
      null,
      'V6',
      now()
    )
    into v_shadow_question_id;
  end if;

  with checks(name, ok) as (
    values
      (
        'V7 ranker exists',
        to_regprocedure(
          'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'
        ) is not null
      ),
      (
        'V7 shadow logging helper exists',
        to_regprocedure(
          'public.obs_log_ot_assessment_v7_shadow_selection(uuid,uuid,uuid,text,timestamptz)'
        ) is not null
      ),
      (
        'V7 shadow log table exists',
        to_regclass('public.obs_router_v7_shadow_log') is not null
      ),
      (
        'V7 shadow log RLS is enabled',
        exists (
          select 1
          from pg_class rel
          join pg_namespace nsp on nsp.oid = rel.relnamespace
          where nsp.nspname = 'public'
            and rel.relname = 'obs_router_v7_shadow_log'
            and rel.relrowsecurity
        )
      ),
      (
        'anon has no direct shadow log access',
        not has_table_privilege('anon', 'public.obs_router_v7_shadow_log', 'select')
        and not has_table_privilege('anon', 'public.obs_router_v7_shadow_log', 'insert')
        and not has_table_privilege('anon', 'public.obs_router_v7_shadow_log', 'update')
        and not has_table_privilege('anon', 'public.obs_router_v7_shadow_log', 'delete')
      ),
      (
        'authenticated has no direct shadow log access',
        not has_table_privilege('authenticated', 'public.obs_router_v7_shadow_log', 'select')
        and not has_table_privilege('authenticated', 'public.obs_router_v7_shadow_log', 'insert')
        and not has_table_privilege('authenticated', 'public.obs_router_v7_shadow_log', 'update')
        and not has_table_privilege('authenticated', 'public.obs_router_v7_shadow_log', 'delete')
      ),
      (
        'anon and authenticated cannot execute V7 internals directly',
        not has_function_privilege('anon', 'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)', 'execute')
        and not has_function_privilege('authenticated', 'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)', 'execute')
        and not has_function_privilege('anon', 'public.obs_log_ot_assessment_v7_shadow_selection(uuid,uuid,uuid,text,timestamptz)', 'execute')
        and not has_function_privilege('authenticated', 'public.obs_log_ot_assessment_v7_shadow_selection(uuid,uuid,uuid,text,timestamptz)', 'execute')
      ),
      (
        'service role can use V7 internals',
        has_function_privilege('service_role', 'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)', 'execute')
        and has_function_privilege('service_role', 'public.obs_log_ot_assessment_v7_shadow_selection(uuid,uuid,uuid,text,timestamptz)', 'execute')
        and has_table_privilege('service_role', 'public.obs_router_v7_shadow_log', 'insert')
      ),
      (
        'app-facing OT RPC chain still resolves unchanged',
        to_regprocedure(
          'public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)'
        ) is not null
        and to_regprocedure('public.obs_get_next_ot_assessment_question(uuid)') is not null
        and to_regprocedure(
          'public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)'
        ) is not null
      ),
      (
        'live next-question RPC does not call V7 shadow functions',
        coalesce(pg_get_functiondef('public.obs_get_next_ot_assessment_question(uuid)'::regprocedure), '')
          not like '%obs_rank_ot_assessment_candidates_v7%'
        and coalesce(pg_get_functiondef('public.obs_get_next_ot_assessment_question(uuid)'::regprocedure), '')
          not like '%obs_log_ot_assessment_v7_shadow_selection%'
      ),
      (
        'displayed BLI RPC does not call V7 metadata or shadow functions',
        coalesce(pg_get_functiondef('public.obs_get_bli_scores_v2(uuid)'::regprocedure), '')
          not like '%obs_question_ladder_metadata%'
        and coalesce(pg_get_functiondef('public.obs_get_bli_scores_v2(uuid)'::regprocedure), '')
          not like '%obs_rank_ot_assessment_candidates_v7%'
        and coalesce(pg_get_functiondef('public.obs_get_bli_scores_v2(uuid)'::regprocedure), '')
          not like '%obs_router_v7_shadow_log%'
      ),
      (
        'V7 ranker returns candidates for an existing OT attempt when test data exists',
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
          )
        )
      ),
      (
        'V7 ranker returns only renderable multiple-choice candidates',
        v_attempt_id is null
        or not exists (
          select 1
          from public.obs_rank_ot_assessment_candidates_v7(
            v_attempt_id,
            v_user_id,
            'V7_SHADOW',
            null,
            now(),
            50
          ) ranked
          where ranked.prompt is null
             or ranked.payload is null
             or not (ranked.payload ? 'choices')
             or not (ranked.payload ? 'correct_choice_id')
             or ranked.book_code is null
             or ranked.dimension_key is null
        )
      ),
      (
        'V7 ranker joins ladder metadata for every returned row',
        v_attempt_id is null
        or not exists (
          select 1
          from public.obs_rank_ot_assessment_candidates_v7(
            v_attempt_id,
            v_user_id,
            'V7_SHADOW',
            null,
            now(),
            50
          ) ranked
          left join public.obs_question_ladder_metadata metadata
            on metadata.generated_question_id = ranked.generated_question_id
          where metadata.generated_question_id is null
             or ranked.v7_routing_granularity is null
             or ranked.v7_scoring_scope_level is null
             or ranked.v7_depth_stage is null
             or ranked.v7_parent_gate is null
        )
      ),
      (
        'V7 parent gate prevents narrow-first when an eligible broader candidate exists',
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
      ),
      (
        'V7 campaign candidates expose spend accounting scope',
        v_attempt_id is null
        or not exists (
          select 1
          from public.obs_rank_ot_assessment_candidates_v7(
            v_attempt_id,
            v_user_id,
            'V7_SHADOW',
            null,
            now(),
            50
          ) ranked
          where (ranked.campaign_phase is not null or ranked.campaign_match is not null)
            and nullif(ranked.v7_campaign_spend_scope, '') is null
        )
      ),
      (
        'V7 ranker/helper did not mutate attempts or answers',
        (select count(*) from public.assessment_attempts) = v_attempts_before
        and (select count(*) from public.assessment_answers) = v_answers_before
      ),
      (
        'shadow helper only appends shadow log rows when candidate exists',
        v_attempt_id is null
        or v_shadow_question_id is null
        or (select count(*) from public.obs_router_v7_shadow_log) = v_shadow_logs_before + 1
      )
  )
  select coalesce(jsonb_agg(name order by name) filter (where not ok), '[]'::jsonb)
  into v_failures
  from checks;

  if jsonb_array_length(v_failures) > 0 then
    raise exception 'FAIL: V7 shadow router verification failed: %', v_failures;
  end if;
end;
$$;

rollback;
