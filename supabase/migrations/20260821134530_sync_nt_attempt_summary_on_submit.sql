-- Persist NT assessment attempt summary counters on submit.
--
-- The NT submit RPC already calculates and returns answered/correct/complete
-- state to the frontend, but the assessment_attempts row only received
-- completed_at. That leaves resume/status/history flows reading stale attempt
-- counters after successful submissions.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Resolved definition for public.obs_submit_nt_assessment_answer(uuid, uuid, text).
-- Captured verbatim from production with pg_get_functiondef after the
-- original string-mutation form of this migration was applied, so replaying
-- this file from zero produces the same body that production runs.
CREATE OR REPLACE FUNCTION public.obs_submit_nt_assessment_answer(p_attempt_id uuid, p_generated_question_id uuid, p_selected_choice_id text)
 RETURNS TABLE(is_correct boolean, is_idk boolean, correct_choice_id text, answered_count integer, correct_count integer, target_question_count integer, target_reached boolean, remaining_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_attempt record;
  v_question record;
  v_existing record;
  v_is_idk boolean;
  v_is_correct boolean;
  v_correct_choice_id text;
  v_answered integer;
  v_correct integer;
  v_division_scope text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select
    attempt.id,
    attempt.scope_key,
    greatest(1, coalesce(attempt.target_question_count, 20)) as target_count
  into v_attempt
  from public.assessment_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = v_user_id
    and upper(coalesce(attempt.testament, 'NT')) = 'NT'
  for update;

  if v_attempt.id is null then
    raise exception using errcode = '42501', message = 'Attempt not found or not authorized';
  end if;

  select
    question.generated_question_id,
    generated.event_id,
    question.payload,
    question.book_code,
    book.nt_division
  into v_question
  from public.v_nt_question_bank question
  join public.ot_generated_questions generated
    on generated.id = question.generated_question_id
  left join public.scripture_books book
    on book.book_code = question.book_code
  where question.generated_question_id = p_generated_question_id
    and public.obs_nt_question_matches_scope(
      question.book_code,
      book.nt_division,
      v_attempt.scope_key
    )
  limit 1;

  if v_question.generated_question_id is null then
    raise exception using
      errcode = '22023',
      message = 'Question is not active or does not belong to this assessment scope';
  end if;

  v_correct_choice_id := coalesce(
    v_question.payload->>'correct_choice_id',
    v_question.payload->>'answer_id',
    v_question.payload->>'correctAnswerId'
  );

  if v_correct_choice_id is null then
    raise exception using errcode = '22023', message = 'Question has no answer key';
  end if;

  v_is_idk := upper(coalesce(p_selected_choice_id, '')) = '__IDK__';

  if not v_is_idk and not exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(v_question.payload->'choices') = 'array'
          then v_question.payload->'choices'
        else '[]'::jsonb
      end
    ) choice
    where choice->>'id' = p_selected_choice_id
  ) then
    raise exception using errcode = '22023', message = 'Selected choice is invalid';
  end if;

  select
    answer.selected_choice_id,
    answer.is_correct,
    coalesce(answer.is_idk, false) as is_idk
  into v_existing
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id
    and answer.generated_question_id = p_generated_question_id
    and answer.user_id = v_user_id
  limit 1;

  if found then
    if v_existing.selected_choice_id is distinct from p_selected_choice_id then
      raise exception using
        errcode = '22023',
        message = 'Question already answered; the recorded NT response cannot be changed';
    end if;

    v_is_correct := v_existing.is_correct;
    v_is_idk := v_existing.is_idk;
  else
    v_is_correct := not v_is_idk
      and p_selected_choice_id = v_correct_choice_id;

    insert into public.assessment_answers (
      attempt_id,
      user_id,
      generated_question_id,
      selected_choice_id,
      is_correct,
      is_idk,
      answered_at
    ) values (
      p_attempt_id,
      v_user_id,
      p_generated_question_id,
      p_selected_choice_id,
      v_is_correct,
      v_is_idk,
      now()
    );

    v_division_scope := public.obs_nt_scope_key(
      v_question.nt_division,
      null
    );

    perform public.update_theta_internal(
      v_user_id,
      v_division_scope,
      v_question.event_id,
      v_is_correct
    );
    perform public.update_theta_internal(
      v_user_id,
      'NT',
      v_question.event_id,
      v_is_correct
    );
  end if;

  select
    count(*)::integer,
    count(*) filter (where answer.is_correct)::integer
  into v_answered, v_correct
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id
    and answer.user_id = v_user_id;

  update public.assessment_attempts
  set
    answered_count = v_answered,
    correct_count = v_correct,
    is_complete = v_answered >= v_attempt.target_count,
    completed_at = case
      when v_answered >= v_attempt.target_count
        then coalesce(completed_at, now())
      else completed_at
    end
  where id = p_attempt_id;

  return query
  select
    v_is_correct,
    v_is_idk,
    v_correct_choice_id,
    v_answered,
    v_correct,
    v_attempt.target_count,
    v_answered >= v_attempt.target_count,
    greatest(v_attempt.target_count - v_answered, 0);
end;
$function$
;

revoke all on function public.obs_submit_nt_assessment_answer(
  uuid, uuid, text
) from public, anon;
grant execute on function public.obs_submit_nt_assessment_answer(
  uuid, uuid, text
) to authenticated, service_role;

comment on function public.obs_submit_nt_assessment_answer(
  uuid, uuid, text
) is
  'Grades and persists the first NT answer; exact retries return the original result, changed responses are rejected, and attempt counters stay synchronized.';

notify pgrst, 'reload schema';

commit;
