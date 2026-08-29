-- Router v6, step 11: do not let the cold-start fast selector shadow a
-- dashboard foundation-gap item.
--
-- Step 10 promotes the item inside the v6 ranker. This wrapper guard ensures
-- get_next_assessment_question actually reaches that ranker when the learner's
-- current ladder focus is an insufficient-evidence unit with no scoring stage-1
-- answer yet.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $migration$
declare
  v_sql text;
  v_original text;
begin
  if to_regprocedure('public.get_next_assessment_question(uuid,uuid)') is null
     or to_regprocedure('public.obs_get_ladder_state_v1(uuid)') is null
     or to_regprocedure('public.obs_unit_has_foundation_items(text)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 11 prerequisites are missing; nothing was changed.';
  end if;

  select pg_get_functiondef(
    'public.get_next_assessment_question(uuid,uuid)'::regprocedure
  )
  into v_sql;

  v_original := v_sql;

  if v_sql like '%v_dashboard_foundation_gap%' then
    raise notice 'Router v6 fast-selector foundation-gap guard is already installed.';
    return;
  end if;

  v_sql := replace(
    v_sql,
$needle$
  v_fast_answer_limit integer := 4;
  v_scored_answered integer := 0;
$needle$,
$replacement$
  v_fast_answer_limit integer := 4;
  v_scored_answered integer := 0;
  v_dashboard_foundation_gap boolean := false;
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
  where answer.attempt_id = p_attempt_id
    and answer.user_id = p_user_id;

  -- The fast baseline selector keeps only the opening cold-start scan. Under
$needle$,
$replacement$
  where answer.attempt_id = p_attempt_id
    and answer.user_id = p_user_id;

  select exists (
    select 1
    from public.obs_get_ladder_state_v1(p_user_id) ladder
    where ladder.is_focus
      and ladder.state = 'insufficient_evidence'
      and public.obs_unit_has_foundation_items(ladder.unit_key)
      and not exists (
        select 1
        from public.assessment_answers answer
        join public.obs_question_bank_with_units question
          on question.generated_question_id = answer.generated_question_id
        left join public.bible_events event
          on event.id = question.event_id
        where answer.user_id = p_user_id
          and answer.scoring_eligible
          and question.unit_key = ladder.unit_key
          and public.obs_focused_item_stage(
            question.question_type,
            question.payload,
            public.obs_effective_item_irt_b(question.payload, event.irt_b::double precision)
          ) = 1
      )
      and exists (
        select 1
        from public.obs_question_bank_with_units question
        left join public.bible_events event
          on event.id = question.event_id
        where question.unit_key = ladder.unit_key
          and question.payload ? 'choices'
          and jsonb_typeof(question.payload->'choices') = 'array'
          and public.obs_focused_item_stage(
            question.question_type,
            question.payload,
            public.obs_effective_item_irt_b(question.payload, event.irt_b::double precision)
          ) = 1
          and not exists (
            select 1
            from public.assessment_answers previous
            where previous.user_id = p_user_id
              and previous.generated_question_id = question.generated_question_id
              and previous.scoring_eligible
          )
      )
  )
  into v_dashboard_foundation_gap;

  -- The fast baseline selector keeps only the opening cold-start scan. Under
$replacement$
  );

  v_sql := replace(
    v_sql,
$needle$
       and v_mode = 'cold_start'
       and v_scored_answered < v_fast_answer_limit
$needle$,
$replacement$
       and v_mode = 'cold_start'
       and not v_dashboard_foundation_gap
       and v_scored_answered < v_fast_answer_limit
$replacement$
  );

  if v_sql = v_original
     or v_sql not like '%v_dashboard_foundation_gap%'
     or v_sql not like '%not v_dashboard_foundation_gap%' then
    raise exception using
      errcode = 'P0001',
      message = 'Router v6 step 11 patch did not match the expected function body.';
  end if;

  execute v_sql;
end
$migration$;

comment on function public.get_next_assessment_question(uuid, uuid) is
  'Returns the next OT assessment question. Under router v6, skips the opening cold-start fast selector when the current ladder focus is a unit-level foundation evidence gap, so the v6 FOUNDATION_GAP lane can serve the missing stage-1 item.';

revoke all on function public.get_next_assessment_question(uuid, uuid) from public;
grant execute on function public.get_next_assessment_question(uuid, uuid) to authenticated, service_role;

commit;
