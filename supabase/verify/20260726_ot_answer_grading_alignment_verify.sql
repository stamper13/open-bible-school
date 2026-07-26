do $$
declare
  current_mismatches integer;
  attempt_counter_mismatches integer;
  grading_definition text;
  review_definition text;
begin
  select count(*)
  into current_mismatches
  from public.assessment_answers answer
  join public.assessment_attempts attempt
    on attempt.id = answer.attempt_id
  join public.ot_generated_questions question
    on question.id = answer.generated_question_id
  where attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
    and upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and not coalesce(answer.is_idk, false)
    and answer.is_correct is distinct from (
      answer.selected_choice_id = coalesce(
        question.payload->>'correct_choice_id',
        question.payload->>'answer_id',
        question.payload->>'correctAnswerId'
      )
    );

  select count(*)
  into attempt_counter_mismatches
  from public.assessment_attempts attempt
  cross join lateral (
    select count(*) filter (where answer.is_correct)::integer as correct_count
    from public.assessment_answers answer
    where answer.attempt_id = attempt.id
  ) totals
  where attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
    and attempt.correct_count is distinct from totals.correct_count;

  select pg_get_functiondef(
    'public.submit_assessment_answer_v2(uuid,uuid,uuid,text)'::regprocedure
  )
  into grading_definition;

  select pg_get_functiondef(
    'public.obs_get_attempt_review(uuid,uuid)'::regprocedure
  )
  into review_definition;

  if current_mismatches <> 0
     or attempt_counter_mismatches <> 0
     or grading_definition not like
       '%v_attempt.assessment_kind in (''ot_adaptive'', ''ot_focused'')%'
     or grading_definition not like
       '%then v_question.payload%'
     or review_definition not like
       '%public.assessment_scramble_mcq(%'
     or review_definition not like
       '%not in (%''ot_adaptive''%''ot_focused''%'
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'FAIL: current_mismatches=%s attempt_counter_mismatches=%s grading_contract=%s review_contract=%s.',
        current_mismatches,
        attempt_counter_mismatches,
        grading_definition like '%then v_question.payload%',
        review_definition like '%public.assessment_scramble_mcq(%'
      );
  end if;

  raise notice
    'PASS: persistent OT grading matches delivered choice IDs; attempt totals and legacy review reconstruction are aligned.';
end
$$;

select
  attempt.assessment_kind,
  count(*)::integer as answers,
  count(*) filter (where answer.is_correct)::integer as correct,
  count(*) filter (where coalesce(answer.is_idk, false))::integer as idk
from public.assessment_answers answer
join public.assessment_attempts attempt
  on attempt.id = answer.attempt_id
where attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
group by attempt.assessment_kind
order by attempt.assessment_kind;
