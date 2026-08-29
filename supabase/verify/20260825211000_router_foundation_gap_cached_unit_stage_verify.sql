begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
declare
  v_get_next text;
  v_refresh text;
  v_unit_stage_rows integer;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'obs_router_candidate_facts'
      and column_name = 'unit_key'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: obs_router_candidate_facts.unit_key is missing.';
  end if;

  select count(*)::integer
  into v_unit_stage_rows
  from public.obs_router_candidate_facts
  where unit_key is not null
    and candidate_stage = 1
    and is_valid_assessment_candidate;

  if v_unit_stage_rows < 100 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'FAIL: too few cached unit stage-1 rows: %s.',
        v_unit_stage_rows
      );
  end if;

  select pg_get_functiondef('public.obs_refresh_router_candidate_facts()'::regprocedure)
  into v_refresh;

  if v_refresh not like '%unit_question.unit_key%'
     or v_refresh not like '%obs_question_bank_with_units unit_question%' then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: candidate facts refresh does not populate unit_key.';
  end if;

  select pg_get_functiondef('public.get_next_assessment_question(uuid,uuid)'::regprocedure)
  into v_get_next;

  if v_get_next not like '%dashboard foundation-gap cached unit stage%'
     or v_get_next not like '%obs_router_candidate_facts question%'
     or v_get_next like '%obs_unit_has_foundation_items(ladder.unit_key)%'
     or v_get_next like '%from public.obs_question_bank_with_units question%left join public.bible_events event%' then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: get_next_assessment_question is not using cached unit/stage foundation-gap checks.';
  end if;

  if not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag = '20260825211000_router_foundation_gap_cached_unit_stage'
      and backup.object_name = 'get_next_assessment_question'
  ) or not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag = '20260825211000_router_foundation_gap_cached_unit_stage'
      and backup.object_name = 'obs_refresh_router_candidate_facts'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: rollback backups for cached foundation-gap migration are missing.';
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
  v_question uuid;
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

  select out_generated_question_id
  into v_question
  from public.get_next_assessment_question(v_attempt_id, v_user_id)
  limit 1;

  if v_question is null then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: get_next_assessment_question returned no cached-foundation smoke candidate.';
  end if;
end
$$;

rollback;
