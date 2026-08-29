begin;

do $$
declare
  v_failures text[] := array[]::text[];
  v_nt_total integer;
  v_nt_metadata integer;
  v_nt_chapter_addressed integer;
  v_get_next_definition text;
  v_attempt_id uuid;
  v_user_id uuid;
  v_candidate_count integer;
begin
  select count(*)::integer
  into v_nt_total
  from public.v_nt_question_bank;

  select count(*)::integer
  into v_nt_metadata
  from public.v_nt_question_bank question
  join public.obs_question_ladder_metadata metadata
    on metadata.generated_question_id = question.generated_question_id;

  select count(*)::integer
  into v_nt_chapter_addressed
  from public.v_nt_question_bank question
  join public.obs_question_ladder_metadata metadata
    on metadata.generated_question_id = question.generated_question_id
  where metadata.chapter_addressed_prompt;

  select pg_get_functiondef(
    'public.obs_get_next_nt_assessment_question(uuid)'::regprocedure
  )
  into v_get_next_definition;

  select attempt.id, attempt.user_id
  into v_attempt_id, v_user_id
  from public.assessment_attempts attempt
  where upper(coalesce(attempt.testament, 'NT')) = 'NT'
    and not coalesce(attempt.is_complete, false)
    and attempt.completed_at is null
  order by attempt.created_at desc
  limit 1;

  if v_attempt_id is not null then
    select count(*)::integer
    into v_candidate_count
    from public.obs_rank_nt_assessment_candidates_v7(
      v_attempt_id,
      v_user_id,
      'NT_V7_VERIFY',
      null,
      now(),
      10
    );
  end if;

  if to_regprocedure(
    'public.obs_rank_nt_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)'
  ) is null then
    v_failures := v_failures || 'NT V7 ranker is missing';
  end if;

  if to_regprocedure(
    'public.obs_log_nt_assessment_v7_shadow_selection(uuid,uuid,uuid,timestamptz)'
  ) is null then
    v_failures := v_failures || 'NT V7 shadow logging helper is missing';
  end if;

  if to_regclass('public.obs_router_nt_v7_shadow_log') is null then
    v_failures := v_failures || 'NT V7 shadow log table is missing';
  end if;

  if v_nt_total < 250 then
    v_failures := v_failures || format(
      'NT question bank unexpectedly small: %s',
      v_nt_total
    );
  end if;

  if v_nt_metadata <> v_nt_total then
    v_failures := v_failures || format(
      'NT ladder metadata coverage mismatch: %s/%s',
      v_nt_metadata,
      v_nt_total
    );
  end if;

  if v_nt_chapter_addressed < 100 then
    v_failures := v_failures || format(
      'NT chapter-addressed metadata looks too low: %s',
      v_nt_chapter_addressed
    );
  end if;

  if exists (
    select 1
    from public.v_nt_question_bank question
    join public.obs_question_ladder_metadata metadata
      on metadata.generated_question_id = question.generated_question_id
    where metadata.section_key not in (
      'GOSPELS',
      'ACTS',
      'GOSPELS_ACTS',
      'PAULINE',
      'GENERAL',
      'APOCALYPSE'
    )
  ) then
    v_failures := v_failures || 'NT metadata has unexpected section keys';
  end if;

  if exists (
    select 1
    from public.v_nt_question_bank question
    join public.obs_question_ladder_metadata metadata
      on metadata.generated_question_id = question.generated_question_id
    where metadata.depth_stage not between 1 and 5
       or metadata.routing_granularity not in (
         'unknown',
         'nt_overview',
         'section_overview',
         'book_overview',
         'book_intersection',
         'unit_overview',
         'chapter_range',
         'chapter_detail',
         'verse_detail'
       )
       or metadata.scoring_scope_level not in (
         'unknown',
         'nt',
         'section',
         'book',
         'unit',
         'chapter',
         'passage'
       )
  ) then
    v_failures := v_failures || 'NT metadata has invalid ladder values';
  end if;

  if has_function_privilege(
    'anon',
    'public.obs_rank_nt_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)',
    'execute'
  )
  or has_function_privilege(
    'authenticated',
    'public.obs_rank_nt_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)',
    'execute'
  )
  or has_function_privilege(
    'anon',
    'public.obs_log_nt_assessment_v7_shadow_selection(uuid,uuid,uuid,timestamptz)',
    'execute'
  )
  or has_function_privilege(
    'authenticated',
    'public.obs_log_nt_assessment_v7_shadow_selection(uuid,uuid,uuid,timestamptz)',
    'execute'
  ) then
    v_failures := v_failures
      || 'anon/authenticated can execute NT V7 shadow internals';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.obs_rank_nt_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)',
    'execute'
  )
  or not has_function_privilege(
    'service_role',
    'public.obs_log_nt_assessment_v7_shadow_selection(uuid,uuid,uuid,timestamptz)',
    'execute'
  ) then
    v_failures := v_failures
      || 'service_role cannot execute NT V7 shadow internals';
  end if;

  if has_table_privilege(
    'anon',
    'public.obs_router_nt_v7_shadow_log',
    'select'
  )
  or has_table_privilege(
    'authenticated',
    'public.obs_router_nt_v7_shadow_log',
    'select'
  ) then
    v_failures := v_failures
      || 'anon/authenticated can read NT V7 shadow log';
  end if;

  if coalesce(v_get_next_definition, '') like '%obs_rank_nt_assessment_candidates_v7%' then
    v_failures := v_failures
      || 'app-facing NT next-question RPC calls shadow V7 ranker';
  end if;

  if v_attempt_id is not null and coalesce(v_candidate_count, 0) = 0 then
    v_failures := v_failures
      || 'NT V7 ranker returned no candidates for an open NT attempt';
  end if;

  if array_length(v_failures, 1) is not null then
    raise exception using
      errcode = 'P0001',
      message = '20260827110000_nt_router_v7_shadow_prep_verify failed: '
        || array_to_string(v_failures, '; ');
  end if;
end $$;

rollback;
