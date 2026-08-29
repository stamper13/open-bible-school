-- Router v6, step 17: cap repeated section-taxonomy screens per attempt.
--
-- The v5 base pool can keep surfacing "which group/book belongs to this canon
-- section" prompts after a learner has already answered enough of that shape
-- in the same sitting. Cap those screens so later questions move back toward
-- specific book/content evidence.

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

  if v_sql not like '%cap repeated section-taxonomy screens inside one assessment%' then
    v_sql := replace(
      v_sql,
$needle$
    where not public.obs_is_order_response_question(scored.question_type, scored.payload)
      and coalesce(scored.payload->>'interaction_type', '') <> 'drag_order_v1'
$needle$,
$replacement$
    where not public.obs_is_order_response_question(scored.question_type, scored.payload)
      and coalesce(scored.payload->>'interaction_type', '') <> 'drag_order_v1'
      -- cap repeated section-taxonomy screens inside one assessment
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
$replacement$
    );

    if v_sql = v_original
       or v_sql not like '%cap repeated section-taxonomy screens inside one assessment%' then
      raise exception using
        errcode = 'P0001',
        message = 'Could not patch v6 ranker section-taxonomy cap.';
    end if;

    execute v_sql;
  end if;
end
$migration$;

comment on function public.obs_rank_ot_assessment_candidates_v6(uuid, uuid, text, integer, timestamptz, integer) is
  'Mode-aware wrapper over v5. Excludes unsupported order-response questions, caps repeated section-taxonomy screens per attempt, demotes chapter-addressed high-specificity campaign items, and promotes phase-matching campaign evidence subject to per-attempt caps. STABLE: writes nothing.';

notify pgrst, 'reload schema';

commit;
