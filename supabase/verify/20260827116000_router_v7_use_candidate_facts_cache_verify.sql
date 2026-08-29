begin;

do $$
declare
  v_failures text[] := array[]::text[];
  v_get_next text;
  v_ranker text;
  v_cached_count integer;
  v_valid_count integer;
  v_attempt_id uuid;
  v_user_id uuid;
  v_candidate_count integer;
begin
  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into v_get_next;

  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_ranker;

  if coalesce(v_get_next, '') not like '%v7 candidate-facts cache substitution%' then
    v_failures := v_failures
      || 'get_next_assessment_question is missing the candidate-facts cache marker';
  end if;

  if coalesce(v_ranker, '') not like '%v7 candidate-facts cache substitution%' then
    v_failures := v_failures
      || 'obs_rank_ot_assessment_candidates_v7 is missing the candidate-facts cache marker';
  end if;

  if coalesce(v_get_next, '') like '%public.obs_question_bank_with_dimensions%'
     or coalesce(v_ranker, '') like '%public.obs_question_bank_with_dimensions%' then
    v_failures := v_failures
      || 'active V7 functions still expand obs_question_bank_with_dimensions';
  end if;

  if coalesce(v_get_next, '') not like '%public.obs_router_candidate_facts%'
     or coalesce(v_ranker, '') not like '%public.obs_router_candidate_facts%' then
    v_failures := v_failures
      || 'active V7 functions do not use obs_router_candidate_facts';
  end if;

  if to_regclass('public.obs_router_candidate_facts') is null then
    v_failures := v_failures || 'obs_router_candidate_facts table is missing';
  else
    select
      count(*)::integer,
      count(*) filter (where is_valid_assessment_candidate)::integer
    into v_cached_count, v_valid_count
    from public.obs_router_candidate_facts;

    if coalesce(v_cached_count, 0) < 1000 or coalesce(v_valid_count, 0) < 1000 then
      v_failures := v_failures
        || format(
          'obs_router_candidate_facts is unexpectedly sparse: %s cached, %s valid',
          coalesce(v_cached_count, 0),
          coalesce(v_valid_count, 0)
        );
    end if;
  end if;

  if to_regprocedure('public.obs_get_next_ot_assessment_question(uuid)') is null
     or to_regprocedure(
       'public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)'
     ) is null then
    v_failures := v_failures
      || 'app-facing OT RPC chain no longer resolves';
  end if;

  if to_regprocedure('public.obs_get_next_nt_assessment_question(uuid)') is null
     or to_regprocedure(
       'public.obs_submit_nt_assessment_answer(uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.obs_start_nt_assessment(text,text,integer)'
     ) is null then
    v_failures := v_failures
      || 'app-facing NT RPC chain no longer resolves';
  end if;

  if to_regclass('public.obs_router_config') is not null
     and not exists (
       select 1
       from public.obs_router_config
       where key = 'active_version'
         and value = 'V7'
     ) then
    v_failures := v_failures
      || 'active OT router version is not V7';
  end if;

  select attempt.id, attempt.user_id
  into v_attempt_id, v_user_id
  from public.assessment_attempts attempt
  where upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and coalesce(attempt.user_id::text, '') <> ''
  order by attempt.created_at desc
  limit 1;

  if v_attempt_id is not null and v_user_id is not null then
    select count(*)::integer
    into v_candidate_count
    from public.obs_rank_ot_assessment_candidates_v7(
      v_attempt_id,
      v_user_id,
      'VERIFY_V7_CACHE',
      10,
      now(),
      10
    ) ranked
    where ranked.generated_question_id is not null
      and ranked.payload ? 'choices'
      and jsonb_typeof(ranked.payload->'choices') = 'array';

    if coalesce(v_candidate_count, 0) = 0 then
      v_failures := v_failures
        || 'V7 ranker did not return renderable candidates for the latest OT attempt';
    end if;
  end if;

  if array_length(v_failures, 1) is not null then
    raise exception using
      errcode = 'P0001',
      message = '20260827116000_router_v7_use_candidate_facts_cache_verify failed: '
        || array_to_string(v_failures, '; ');
  end if;
end
$$;

rollback;
