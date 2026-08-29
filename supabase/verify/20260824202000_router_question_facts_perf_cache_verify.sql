begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
declare
  v_function text;
  v_fact_rows integer;
begin
  if to_regclass('public.obs_router_question_facts') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: obs_router_question_facts table is missing.';
  end if;

  select count(*)::integer
  into v_fact_rows
  from public.obs_router_question_facts;

  if v_fact_rows < 1000 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'FAIL: obs_router_question_facts has too few rows: %s.',
        v_fact_rows
      );
  end if;

  select pg_get_functiondef(
    'public.obs_router_scope_baseline_met(uuid,text,timestamptz)'::regprocedure
  )
  into v_function;

  if v_function not like '%obs_router_question_facts%' then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: obs_router_scope_baseline_met is not using the router facts cache.';
  end if;

  if not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag = '20260824202000_router_question_facts_perf_cache'
      and backup.object_name = 'obs_router_scope_baseline_met'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: rollback backup for obs_router_scope_baseline_met is missing.';
  end if;
end
$$;

do $$
declare
  v_start_v2 regprocedure :=
    'public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)'::regprocedure;
  v_next regprocedure :=
    'public.obs_get_next_ot_assessment_question(uuid)'::regprocedure;
  v_submit_v2 regprocedure :=
    'public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)'::regprocedure;
begin
  if not has_function_privilege('authenticated', v_start_v2, 'execute')
     or not has_function_privilege('authenticated', v_next, 'execute')
     or not has_function_privilege('authenticated', v_submit_v2, 'execute') then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: app-facing OT RPC chain lost authenticated execute privilege.';
  end if;

  if has_function_privilege('anon', v_start_v2, 'execute')
     or has_function_privilege('anon', v_next, 'execute')
     or has_function_privilege('anon', v_submit_v2, 'execute') then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: app-facing OT RPC chain unexpectedly allows anon execute.';
  end if;
end
$$;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_attempt_id uuid := gen_random_uuid();
  v_scope text;
  v_expected boolean;
  v_actual boolean;
  v_start timestamptz;
  v_elapsed_ms numeric;
begin
  insert into auth.users (
    id,
    aud,
    role,
    is_anonymous,
    created_at,
    updated_at
  ) values (
    v_user_id,
    'authenticated',
    'authenticated',
    true,
    now(),
    now()
  );

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.assessment_attempts (
    id,
    user_id,
    prior_self_rating,
    question_target,
    assessment_kind,
    target_question_count,
    total_count,
    testament,
    scope_key,
    assessment_mode
  ) values (
    v_attempt_id,
    v_user_id,
    3,
    50,
    'ot_adaptive',
    50,
    50,
    'OT',
    'OT',
    'adaptive'
  );

  insert into public.assessment_answers (
    attempt_id,
    user_id,
    generated_question_id,
    selected_choice_id,
    is_correct,
    is_idk,
    scoring_eligible,
    answered_at
  )
  select
    v_attempt_id,
    v_user_id,
    question.generated_question_id,
    'A',
    true,
    false,
    true,
    now() - (row_number() over (order by question.generated_question_id) || ' seconds')::interval
  from public.obs_router_question_facts question
  where question.section_key = 'TORAH'
  order by question.generated_question_id
  limit 5;

  for v_scope in select unnest(array['TORAH', 'FORMER']) loop
    with config as (
      select *
      from public.obs_router_policy_config
      where policy_key = 'OT_GENERAL'
    ),
    ranked as (
      select
        answer.generated_question_id,
        answer.is_correct,
        coalesce(answer.is_idk, false) as is_idk,
        greatest(
          1,
          coalesce(
            question.importance_conceptual,
            question.routing_score,
            question.importance_context,
            50
          )
        )::numeric as weight,
        row_number() over (
          partition by answer.generated_question_id
          order by answer.answered_at desc, answer.id desc
        ) as recency_rank
      from public.assessment_answers answer
      join public.obs_question_bank_with_dimensions question
        on question.generated_question_id = answer.generated_question_id
      where answer.user_id = v_user_id
        and answer.scoring_eligible
        and answer.answered_at <= now()
        and public.canonical_assessment_scope(question.book_code) = v_scope
    ),
    evidence as (
      select *
      from ranked
      where recency_rank = 1
        and not is_idk
    ),
    score as (
      select
        count(*)::integer as answered,
        sum(weight) as possible,
        sum(weight) filter (where is_correct) as earned
      from evidence
    ),
    display as (
      select
        answered,
        case
          when coalesce(possible, 0) <= 0 then 200
          else public.obs_display_score_from_raw(
            (
              greatest(
                0.0,
                least(
                  1.0,
                  (
                    coalesce(earned, 0) / possible - 0.25
                  ) / 0.75
                )
              ) * 100
            )::numeric
          )
        end as display_score
      from score
    )
    select
      coalesce(display.answered, 0) >= config.advanced_min_answers
      and coalesce(display.display_score, 200) >= config.advanced_min_display_score
    into v_expected
    from display
    cross join config;

    select public.obs_router_scope_baseline_met(v_user_id, v_scope, now())
    into v_actual;

    if v_actual is distinct from v_expected then
      raise exception using
        errcode = 'P0001',
        message = format(
          'FAIL: cached baseline helper mismatch for %s: expected %s got %s.',
          v_scope,
          v_expected,
          v_actual
        );
    end if;
  end loop;

  v_start := clock_timestamp();
  perform public.obs_router_scope_baseline_met(v_user_id, 'TORAH', now());
  v_elapsed_ms := extract(epoch from clock_timestamp() - v_start) * 1000.0;

  if v_elapsed_ms > 250.0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'FAIL: cached baseline helper exceeded timing gate: %s ms.',
        round(v_elapsed_ms, 2)
      );
  end if;
end
$$;

rollback;
