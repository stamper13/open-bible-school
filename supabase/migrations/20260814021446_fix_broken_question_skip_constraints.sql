create or replace function public.obs_skip_broken_assessment_question(
  p_attempt_id uuid,
  p_generated_question_id uuid,
  p_error_code text default null,
  p_error_message text default null,
  p_context jsonb default '{}'::jsonb
)
returns table (
  answered_count integer,
  correct_count integer,
  target_question_count integer
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.assessment_attempts%rowtype;
  v_question public.ot_generated_questions%rowtype;
  v_eligible_answered integer;
  v_correct integer;
  v_base_target integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into v_attempt
  from public.assessment_attempts attempt
  where attempt.id = p_attempt_id and attempt.user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Attempt not found or not authorized';
  end if;

  select * into v_question
  from public.ot_generated_questions question
  where question.id = p_generated_question_id;

  if not found then
    raise exception using errcode = '22023', message = 'Question not found';
  end if;

  begin
    insert into public.question_reports (
      generated_question_id,
      attempt_id,
      user_id,
      report_category,
      feedback_text,
      selected_choice_id,
      correct_choice_id,
      question_prompt
    ) values (
      p_generated_question_id,
      p_attempt_id,
      v_user_id,
      'other',
      left(concat_ws(E'\n',
        'Auto-skipped broken assessment question.',
        concat('Error code: ', coalesce(p_error_code, 'unknown')),
        concat('Error message: ', coalesce(p_error_message, 'unknown')),
        concat('Context: ', coalesce(p_context, '{}'::jsonb)::text)
      ), 2000),
      null,
      null,
      coalesce(v_question.payload->>'prompt', v_question.payload->>'question_text')
    );
  exception when others then
    raise warning 'Could not log broken assessment question report for question %, attempt %: %',
      p_generated_question_id, p_attempt_id, sqlerrm;
  end;

  insert into public.assessment_answers (
    attempt_id,
    user_id,
    question_id,
    generated_question_id,
    selected_choice_id,
    is_correct,
    is_idk,
    answered_at,
    scoring_eligible,
    scoring_exclusion_reason,
    question_prompt_snapshot,
    delivery_contract
  ) values (
    p_attempt_id,
    v_user_id,
    p_generated_question_id,
    p_generated_question_id,
    '__IDK__',
    false,
    true,
    now(),
    false,
    'auto_skipped_broken_question',
    coalesce(v_question.payload->>'prompt', v_question.payload->>'question_text'),
    'auto_skip_broken_question_v1'
  )
  on conflict (attempt_id, question_id) do update
  set scoring_eligible = false,
      scoring_exclusion_reason = 'auto_skipped_broken_question',
      selected_choice_id = '__IDK__',
      is_correct = false,
      is_idk = true,
      delivery_contract = 'auto_skip_broken_question_v1';

  select count(*)::integer,
         count(*) filter (where answer.is_correct)::integer
  into v_eligible_answered, v_correct
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id
    and answer.user_id = v_user_id
    and answer.scoring_eligible;

  v_base_target := greatest(1, coalesce(
    v_attempt.question_target,
    v_attempt.total_count,
    v_attempt.target_question_count,
    20
  ));

  update public.assessment_attempts attempt
  set answered_count = v_eligible_answered,
      correct_count = v_correct,
      target_question_count = v_base_target,
      total_count = v_base_target,
      is_complete = false,
      completed_at = null
  where attempt.id = p_attempt_id;

  return query select
    v_eligible_answered,
    v_correct,
    v_base_target;
end;
$function$;

revoke all on function public.obs_skip_broken_assessment_question(
  uuid, uuid, text, text, jsonb
) from public;

grant execute on function public.obs_skip_broken_assessment_question(
  uuid, uuid, text, text, jsonb
) to anon, authenticated, service_role;

comment on function public.obs_skip_broken_assessment_question(
  uuid, uuid, text, text, jsonb
) is
  'Logs a broken assessment question best-effort, marks it skipped without scoring using schema-valid choice ids, and keeps the attempt target stable.';

notify pgrst, 'reload schema';
