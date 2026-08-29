-- Router v6, step 18: no empty campaign mode; broader section-screen cap.
--
-- obs_router_mode can report "campaign" because a target exists even when no
-- campaign row is currently open. In that state v6 should behave like ordinary
-- reranking, not like an active campaign with no phase. Also cap broad section
-- screens after enough have appeared in the current sitting.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $migration$
declare
  v_sql text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.obs_rank_ot_assessment_candidates_v6(uuid,uuid,text,integer,timestamptz,integer)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql not like '%empty campaign mode falls back to ordinary reranking%' then
    v_sql := replace(
      v_sql,
$needle$
      mode.routing_mode,
$needle$,
$replacement$
      -- empty campaign mode falls back to ordinary reranking
      case
        when mode.routing_mode = 'campaign' and campaign_scope.id is null
          then 'sweep'
        else mode.routing_mode
      end as routing_mode,
$replacement$
    );
  end if;

  if v_sql not like '%cap broad section screens once this sitting already has three%' then
    v_sql := replace(
      v_sql,
$needle$
      and not (
        scored.selection_lane = 'SECTION_SCREEN'
        and (
          scored.question_type = 'ot_book_section_sort_v1'
          or scored.prompt ~* 'which group consists entirely of books in'
          or scored.prompt ~* 'which book belongs to .+ rather than'
          or scored.prompt ~* 'called the (former prophets|latter prophets|writings)'
        )
        and (
          select count(*)::integer
          from public.assessment_answers answer
          left join public.obs_question_bank_with_dimensions question
            on question.generated_question_id = answer.generated_question_id
          where answer.attempt_id = p_attempt_id
            and answer.user_id = p_user_id
            and answer.answered_at <= coalesce(p_as_of, now())
            and answer.scoring_eligible
            and (
              question.question_type = 'ot_book_section_sort_v1'
              or coalesce(question.payload->>'prompt', question.prompt) ~* 'which group consists entirely of books in'
              or coalesce(question.payload->>'prompt', question.prompt) ~* 'which book belongs to .+ rather than'
              or coalesce(question.payload->>'prompt', question.prompt) ~* 'called the (former prophets|latter prophets|writings)'
            )
        ) >= 2
      )
$needle$,
$replacement$
      and not (
        scored.selection_lane = 'SECTION_SCREEN'
        and (
          scored.question_type = 'ot_book_section_sort_v1'
          or scored.prompt ~* 'which group consists entirely of books in'
          or scored.prompt ~* 'which book belongs to .+ rather than'
          or scored.prompt ~* 'called the (former prophets|latter prophets|writings)'
        )
        and (
          select count(*)::integer
          from public.assessment_answers answer
          left join public.obs_question_bank_with_dimensions question
            on question.generated_question_id = answer.generated_question_id
          where answer.attempt_id = p_attempt_id
            and answer.user_id = p_user_id
            and answer.answered_at <= coalesce(p_as_of, now())
            and answer.scoring_eligible
            and (
              question.question_type = 'ot_book_section_sort_v1'
              or coalesce(question.payload->>'prompt', question.prompt) ~* 'which group consists entirely of books in'
              or coalesce(question.payload->>'prompt', question.prompt) ~* 'which book belongs to .+ rather than'
              or coalesce(question.payload->>'prompt', question.prompt) ~* 'called the (former prophets|latter prophets|writings)'
            )
        ) >= 2
      )
      -- cap broad section screens once this sitting already has three
      and not (
        scored.selection_lane = 'SECTION_SCREEN'
        and (
          select count(*)::integer
          from public.assessment_answers answer
          left join public.obs_question_bank_with_dimensions question
            on question.generated_question_id = answer.generated_question_id
          where answer.attempt_id = p_attempt_id
            and answer.user_id = p_user_id
            and answer.answered_at <= coalesce(p_as_of, now())
            and answer.scoring_eligible
            and (
              lower(coalesce(question.payload->>'question_family', '')) in (
                'section_screen',
                'section_competency'
              )
              or question.question_type in (
                'section_competency_mcq_v1',
                'ot_book_section_sort_v1'
              )
              or coalesce(question.payload->>'prompt', question.prompt) ~* 'which group consists entirely of books in'
              or coalesce(question.payload->>'prompt', question.prompt) ~* 'which book belongs to .+ rather than'
              or coalesce(question.payload->>'prompt', question.prompt) ~* 'called the (former prophets|latter prophets|writings)'
            )
        ) >= 3
      )
$replacement$
    );
  end if;

  if v_sql = v_original
     or v_sql not like '%empty campaign mode falls back to ordinary reranking%'
     or v_sql not like '%cap broad section screens once this sitting already has three%' then
    raise exception using
      errcode = 'P0001',
      message = 'Could not patch v6 empty-campaign fallback and broad section-screen cap.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.obs_rank_ot_assessment_candidates_v6(uuid, uuid, text, integer, timestamptz, integer) is
  'Mode-aware wrapper over v5. Treats campaign mode without an open campaign as ordinary reranking, excludes unsupported order-response questions, caps repeated section screens per attempt, demotes chapter-addressed high-specificity campaign items, and promotes phase-matching campaign evidence subject to per-attempt caps. STABLE: writes nothing.';

notify pgrst, 'reload schema';

commit;
