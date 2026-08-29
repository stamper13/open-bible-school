-- Router v6, step 23: app-wrapper cross-attempt novelty gate.
--
-- Step 20 demotes exact/similarity repeats inside the v6 ranker. A production
-- 200-question replay still leaked a book_orientation repeat through the public
-- next-question wrapper. This patch adds a wrapper-level first pass that skips
-- cross-attempt exact and similarity repeats when another ranked candidate is
-- available, while preserving the existing relaxed fallback so exhausted cells
-- still progress instead of freezing.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $migration$
declare
  v_sql text;
  v_original text;
begin
  if to_regprocedure('public.get_next_assessment_question(uuid,uuid)') is null
     or to_regprocedure(
       'public.obs_assessment_question_similarity_key(jsonb,text,text,text,text)'
     ) is null
     or to_regprocedure('public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)') is null
     or to_regprocedure('public.obs_rank_ot_assessment_candidates_v5(uuid,uuid,text,integer,timestamptz,integer)') is null
     or to_regclass('public.obs_schema_backups') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 23 prerequisites are missing; nothing was changed.';
  end if;

  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql like '%v6 app-wrapper cross-attempt novelty gate%' then
    raise notice 'Router v6 app-wrapper cross-attempt novelty gate is already installed.';
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
    '20260825203000_router_v6_23_app_wrapper_cross_attempt_novelty',
    v_original
  where not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.object_type = 'function'
      and backup.object_schema = 'public'
      and backup.object_name = 'get_next_assessment_question'
      and backup.backup_tag = '20260825203000_router_v6_23_app_wrapper_cross_attempt_novelty'
  );

  v_sql := replace(
    v_sql,
$needle$
      order by ranked.candidate_rank
      limit 1;
    exception when others then
$needle$,
$replacement$
      -- v6 app-wrapper cross-attempt novelty gate
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

      if ranked_row.generated_question_id is null then
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
      end if;
    exception when others then
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
      order by ranked.candidate_rank
      limit 1;
    end if;
  else
$needle$,
$replacement$
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
    end if;
  else
$replacement$
  );

  if v_sql = v_original
     or v_sql not like '%v6 app-wrapper cross-attempt novelty gate%'
     or v_sql not like '%prior_answer.attempt_id <> p_attempt_id%'
     or v_sql not like '%obs_assessment_question_similarity_key(%' then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 23 patch did not match the expected function body.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next adaptive OT question. Under router v6, skips cross-attempt exact/similarity repeats when a non-repeat ranked candidate is available, and falls back to relaxed v6/v5 selection if needed.';

revoke all on function public.get_next_assessment_question(uuid, uuid) from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
