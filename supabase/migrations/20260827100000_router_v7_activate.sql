-- Router V7 activation.
--
-- Promotes the metadata-aware V7 ranker into the app-facing adaptive OT
-- selector while preserving the public RPC chain:
--   obs_start_or_resume_ot_assessment_v2 ->
--   obs_get_next_ot_assessment_question ->
--   obs_submit_ot_assessment_response_v2
--
-- V7 is tried first only when obs_router_policy_config.active_version = 'V7'.
-- The existing V6/V5 fallback path remains in place so a V7 ranker error or
-- exhausted candidate pool does not strand a learner.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
begin
  if to_regclass('public.obs_router_policy_config') is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regclass('public.assessment_answers') is null
     or to_regclass('public.obs_question_bank_with_dimensions') is null
     or to_regprocedure('public.get_next_assessment_question(uuid,uuid)') is null
     or to_regprocedure('public.obs_rank_ot_assessment_candidates_v7(uuid,uuid,text,integer,timestamptz,integer)') is null
     or to_regprocedure('public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)') is null
     or to_regprocedure('public.obs_rank_ot_assessment_candidates_v5(uuid,uuid,text,integer,timestamptz,integer)') is null
     or to_regprocedure('public.obs_assessment_question_similarity_key(jsonb,text,text,text,text)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 activation prerequisites are missing; nothing was changed.';
  end if;
end
$$;

insert into public.obs_schema_backups (
  object_type,
  object_schema,
  object_name,
  backup_tag,
  definition
)
select
  'function',
  'public',
  'get_next_assessment_question',
  '20260827100000_router_v7_activate',
  pg_get_functiondef('public.get_next_assessment_question(uuid,uuid)'::regprocedure)
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.object_type = 'function'
    and backup.object_schema = 'public'
    and backup.object_name = 'get_next_assessment_question'
    and backup.backup_tag = '20260827100000_router_v7_activate'
);

alter table public.obs_router_policy_config
  drop constraint if exists obs_router_policy_version_ck;

alter table public.obs_router_policy_config
  add constraint obs_router_policy_version_ck
  check (
    active_version in ('V3', 'V4', 'V5', 'V6', 'V7')
    and shadow_version in ('V3', 'V4', 'V5')
    and active_version <> shadow_version
  );

do $migration$
declare
  v_sql text;
  v_original text;
  v_needle text;
  v_count integer;
begin
  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql like '%v7 app-facing activation%' then
    raise notice 'Router V7 activation is already installed.';
    return;
  end if;

  v_needle := $needle$
  if v_active_version = 'V6' then
    begin
      perform public.obs_router_sync_campaign(p_user_id, p_attempt_id);
      v_mode := public.obs_router_mode(p_user_id);
    exception when others then
      v_mode := 'cold_start';
    end;
  end if;
$needle$;
  v_count := (
    length(v_sql) - length(replace(v_sql, v_needle, ''))
  ) / greatest(length(v_needle), 1);

  if v_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Router V7 activation expected one campaign-sync block, found %s.', v_count);
  end if;

  v_sql := replace(
    v_sql,
    v_needle,
$replacement$
  if v_active_version in ('V6', 'V7') then
    begin
      perform public.obs_router_sync_campaign(p_user_id, p_attempt_id);
      v_mode := public.obs_router_mode(p_user_id);
    exception when others then
      v_mode := 'cold_start';
    end;
  end if;
$replacement$
  );

  v_needle := $needle$
  if v_active_version <> 'V6'
     or (
$needle$;
  v_count := (
    length(v_sql) - length(replace(v_sql, v_needle, ''))
  ) / greatest(length(v_needle), 1);

  if v_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Router V7 activation expected one fast-selector condition, found %s.', v_count);
  end if;

  v_sql := replace(
    v_sql,
    v_needle,
$replacement$
  if v_active_version not in ('V6', 'V7')
     or (
$replacement$
  );

  v_needle := $needle$
  if v_active_version = 'V6' then
    -- v6 next-question fallback to v5
$needle$;
  v_count := (
    length(v_sql) - length(replace(v_sql, v_needle, ''))
  ) / greatest(length(v_needle), 1);

  if v_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Router V7 activation expected one V6 ranking block start, found %s.', v_count);
  end if;

  v_sql := replace(
    v_sql,
    v_needle,
$replacement$
  if v_active_version = 'V7' then
    -- v7 app-facing activation
    begin
      select *
      into ranked_row
      from public.obs_rank_ot_assessment_candidates_v7(
        p_attempt_id, p_user_id, 'V7', v_scored_answered, now(), 25
      ) ranked
      where not exists (
        select 1
        from public.assessment_answers answer
        where answer.attempt_id = p_attempt_id
          and answer.user_id = p_user_id
          and answer.generated_question_id = ranked.generated_question_id
      )
      and (
        lower(coalesce(ranked.payload->>'question_family', '')) <> 'book_orientation'
        or v_book_orientation_answered < 7
      )
      and (
        not (
          ranked.question_type = 'ot_book_section_sort_v1'
          or coalesce(ranked.payload->>'prompt', ranked.prompt) ~* 'which group consists entirely of books in'
          or coalesce(ranked.payload->>'prompt', ranked.prompt) ~* 'which book belongs to .+ rather than'
          or coalesce(ranked.payload->>'prompt', ranked.prompt) ~* 'called the (former prophets|latter prophets|writings)'
        )
        or (
          coalesce(attempt_row.answered_count, 0) >= 16
          and v_division_taxonomy_answered = 0
        )
      )
      and not exists (
        select 1
        from public.assessment_answers prior_answer
        where prior_answer.user_id = p_user_id
          and prior_answer.attempt_id <> p_attempt_id
          and prior_answer.generated_question_id = ranked.generated_question_id
          and coalesce(prior_answer.scoring_eligible, true)
          and prior_answer.answered_at <= now()
      )
      and not exists (
        select 1
        from public.assessment_answers prior_answer
        join public.obs_question_bank_with_dimensions prior_question
          on prior_question.generated_question_id =
            prior_answer.generated_question_id
        where prior_answer.user_id = p_user_id
          and prior_answer.attempt_id <> p_attempt_id
          and coalesce(prior_answer.scoring_eligible, true)
          and prior_answer.answered_at <= now()
          and public.obs_assessment_question_similarity_key(
            prior_question.payload,
            prior_question.book_code,
            prior_question.dimension_key,
            prior_question.question_type,
            coalesce(prior_question.payload->>'prompt', prior_question.prompt)
          ) = public.obs_assessment_question_similarity_key(
            ranked.payload,
            ranked.book_code,
            ranked.dimension_key,
            ranked.question_type,
            coalesce(ranked.payload->>'prompt', ranked.prompt)
          )
      )
      order by ranked.candidate_rank
      limit 1;
    exception when others then
      raise warning 'V7 OT ranker failed for attempt %, falling back to V6: [%] %',
        p_attempt_id, sqlstate, sqlerrm;
      ranked_row := null;
    end;
  end if;

  if ranked_row.generated_question_id is null
     and v_active_version in ('V6', 'V7') then
    -- v6 next-question fallback to v5
$replacement$
  );

  v_needle := $needle$
  else
    select *
    into ranked_row
    from public.obs_rank_ot_assessment_candidates_v5(
$needle$;
  v_count := (
    length(v_sql) - length(replace(v_sql, v_needle, ''))
  ) / greatest(length(v_needle), 1);

  if v_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Router V7 activation expected one outer V5 else block, found %s.', v_count);
  end if;

  v_sql := replace(
    v_sql,
    v_needle,
$replacement$
  elsif ranked_row.generated_question_id is null then
    select *
    into ranked_row
    from public.obs_rank_ot_assessment_candidates_v5(
$replacement$
  );

  if v_sql = v_original
     or v_sql not like '%v7 app-facing activation%'
     or v_sql not like '%obs_rank_ot_assessment_candidates_v7%'
     or v_sql not like '%v_active_version in (''V6'', ''V7'')%'
     or v_sql not like '%v_active_version not in (''V6'', ''V7'')%' then
    raise exception using
      errcode = 'P0001',
      message = 'Router V7 activation patch did not produce the expected function body.';
  end if;

  execute v_sql;
end
$migration$;

update public.obs_router_policy_config
set active_version = 'V7',
    updated_at = now()
where policy_key = 'OT_GENERAL';

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question. With active_version V7, tries the metadata-aware V7 ranker first, then falls back to V6/V5 if needed.';

revoke all on function public.get_next_assessment_question(uuid, uuid) from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
