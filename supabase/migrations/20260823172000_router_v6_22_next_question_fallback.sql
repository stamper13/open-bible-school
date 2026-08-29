-- Router v6, step 22: keep the public next-question wrapper recoverable.
--
-- If the V6 ranker errors or produces no eligible row, fall back to the V5
-- selector inside the same app-facing RPC. This preserves the assessment chain
-- and gives the learner another question instead of freezing on an error page.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $migration$
declare
  v_sql text;
  v_original text;
begin
  if to_regprocedure('public.get_next_assessment_question(uuid,uuid)') is null
     or to_regprocedure('public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)') is null
     or to_regprocedure('public.obs_rank_ot_assessment_candidates_v5(uuid,uuid,text,integer,timestamptz,integer)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 22 prerequisites are missing; nothing was changed.';
  end if;

  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql like '%v6 next-question fallback to v5%' then
    raise notice 'Router v6 next-question fallback is already installed.';
    return;
  end if;

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
    '20260823172000_router_v6_22_next_question_fallback',
    v_original
  where exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'obs_schema_backups'
  )
  and not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.object_type = 'function'
      and backup.object_schema = 'public'
      and backup.object_name = 'get_next_assessment_question'
      and backup.backup_tag = '20260823172000_router_v6_22_next_question_fallback'
  );

  v_sql := replace(
    v_sql,
$needle$
  if v_active_version = 'V6' then
    select *
    into ranked_row
    from public.obs_rank_ot_assessment_candidates_v6(
      p_attempt_id, p_user_id, 'V6', null, now(), 25
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
    order by ranked.candidate_rank
    limit 1;
  else
    select *
$needle$,
$replacement$
  if v_active_version = 'V6' then
    -- v6 next-question fallback to v5
    begin
      select *
      into ranked_row
      from public.obs_rank_ot_assessment_candidates_v6(
        p_attempt_id, p_user_id, 'V6', null, now(), 25
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
      order by ranked.candidate_rank
      limit 1;
    exception when others then
      raise warning 'V6 OT ranker failed for attempt %, falling back to V5: [%] %',
        p_attempt_id, sqlstate, sqlerrm;
      ranked_row := null;
    end;

    if ranked_row.generated_question_id is null then
      select *
      into ranked_row
      from public.obs_rank_ot_assessment_candidates_v5(
        p_attempt_id, p_user_id, 'V5', null, now(), 25
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
      order by ranked.candidate_rank
      limit 1;
    end if;
  else
    select *
$replacement$
  );

  if v_sql = v_original
     or v_sql not like '%v6 next-question fallback to v5%'
     or v_sql not like '%V6 OT ranker failed for attempt %'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 22 patch did not match the expected function body.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question. Under router v6, falls back to the v5 selector if v6 ranking fails or yields no eligible candidate.';

revoke all on function public.get_next_assessment_question(uuid, uuid) from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
