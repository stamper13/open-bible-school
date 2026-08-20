-- Restore the OT submit chain dropped by the 2026-08-18 dead-function cleanup.
-- Production ledger version: 20260820123333.
--
-- This is a compatibility restore, not a grading rewrite:
--   * submit_assessment_answer_v2 is restored from repo source.
--   * submit_assessment_answer_v1 is restored only as a thin delegate to v2.
--   * obs_submit_ot_assessment_response is restored from repo source with the
--     later order-response helper patch applied directly.
--
-- The browser calls obs_submit_ot_assessment_response_v2, which already
-- performs choice-contract validation and first-write idempotency before
-- delegating into this chain.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $precondition$
begin
  if to_regclass('public.assessment_attempts') is null
     or to_regclass('public.assessment_answers') is null
     or to_regclass('public.v_question_bank') is null
     or to_regclass('public.obs_ot_attempt_context') is null
     or to_regprocedure('public.update_theta_internal(uuid,text,uuid,boolean)') is null
     or to_regprocedure('public.question_matches_assessment_scope(text,text,text)') is null
     or to_regprocedure('public.canonical_assessment_scope(text)') is null
     or to_regprocedure('public.obs_parse_sequence_order(text)') is null
     or to_regprocedure('public.obs_is_order_response_question(text,jsonb)') is null
     or to_regprocedure('public.obs_submit_ot_assessment_answer(uuid,uuid,text)') is null
     or to_regprocedure('public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'OT submit-chain restore precondition failed; required contracts are missing';
  end if;
end
$precondition$;

create or replace function public.submit_assessment_answer_v2(
  p_attempt_id uuid,
  p_user_id uuid,
  p_generated_question_id uuid,
  p_selected_choice_id text
)
returns table (
  answer_id uuid,
  out_generated_question_id uuid,
  is_correct boolean,
  correct_choice_id text,
  question_type text,
  prompt text,
  testament text,
  scope_key text,
  assessment_mode text,
  answered_count integer,
  total_count integer,
  is_complete boolean
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_attempt public.assessment_attempts%rowtype;
  v_question public.v_question_bank%rowtype;
  v_delivery_payload jsonb;
  v_correct text;
  v_is_correct boolean;
  v_is_idk boolean;
  v_answer_id uuid;
  v_answered integer;
  v_correct_count integer;
  v_total integer;
  v_complete boolean;
  v_section text;
begin
  select *
  into v_attempt
  from public.assessment_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = p_user_id
    and auth.uid() = p_user_id
  for update;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Assessment attempt not found or not authorized';
  end if;

  if v_attempt.is_complete then
    raise exception using
      errcode = '22023',
      message = 'Assessment attempt is already complete';
  end if;

  select *
  into v_question
  from public.v_question_bank question
  where question.generated_question_id = p_generated_question_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Question not found or inactive';
  end if;

  if not public.question_matches_assessment_scope(
    v_question.book_code,
    v_attempt.testament,
    v_attempt.scope_key
  ) then
    raise exception using
      errcode = '22023',
      message = 'Question does not belong to attempt scope';
  end if;

  v_delivery_payload := case
    when v_attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
      and upper(coalesce(v_attempt.testament, 'OT')) = 'OT'
      then v_question.payload
    else public.assessment_scramble_mcq(
      v_question.payload,
      p_attempt_id::text || ':' || p_generated_question_id::text
    )
  end;

  v_correct := coalesce(
    v_delivery_payload->>'correct_choice_id',
    v_delivery_payload->>'answer_id',
    v_delivery_payload->>'correctAnswerId'
  );

  if v_correct is null then
    raise exception using
      errcode = '22023',
      message = 'Question has no resolvable correct answer';
  end if;

  v_is_idk := upper(coalesce(p_selected_choice_id, '')) = '__IDK__';

  if not v_is_idk and not exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(v_delivery_payload->'choices') = 'array'
          then v_delivery_payload->'choices'
        else '[]'::jsonb
      end
    ) choice
    where choice->>'id' = p_selected_choice_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'Invalid choice id';
  end if;

  v_is_correct := not v_is_idk and p_selected_choice_id = v_correct;

  insert into public.assessment_answers (
    attempt_id,
    user_id,
    question_id,
    generated_question_id,
    selected_choice_id,
    is_correct,
    is_idk,
    answered_at
  ) values (
    p_attempt_id,
    p_user_id,
    p_generated_question_id,
    p_generated_question_id,
    p_selected_choice_id,
    v_is_correct,
    v_is_idk,
    now()
  )
  on conflict (attempt_id, question_id) do update set
    selected_choice_id = excluded.selected_choice_id,
    is_correct = excluded.is_correct,
    is_idk = excluded.is_idk,
    answered_at = excluded.answered_at,
    generated_question_id = excluded.generated_question_id,
    user_id = excluded.user_id
  returning id into v_answer_id;

  select
    count(*)::integer,
    count(*) filter (where answer.is_correct)::integer
  into v_answered, v_correct_count
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id;

  v_complete := v_answered >= v_attempt.question_target;

  update public.assessment_attempts attempt
  set
    answered_count = v_answered,
    correct_count = v_correct_count,
    is_complete = v_complete,
    completed_at = case
      when v_complete then coalesce(attempt.completed_at, now())
      else null
    end
  where attempt.id = p_attempt_id
  returning attempt.total_count into v_total;

  if v_question.event_id is not null and not v_is_idk then
    v_section := public.canonical_assessment_scope(v_question.book_code);
    perform public.update_theta_internal(
      p_user_id,
      v_section,
      v_question.event_id,
      v_is_correct
    );
    perform public.update_theta_internal(
      p_user_id,
      v_attempt.testament,
      v_question.event_id,
      v_is_correct
    );
    perform public.update_theta_internal(
      p_user_id,
      'BIBLE',
      v_question.event_id,
      v_is_correct
    );
  end if;

  return query
  select
    v_answer_id,
    v_question.generated_question_id,
    v_is_correct,
    v_correct,
    v_question.question_type,
    coalesce(v_question.payload->>'prompt', v_question.prompt),
    v_attempt.testament,
    v_attempt.scope_key,
    v_attempt.assessment_mode,
    v_answered,
    v_total,
    v_complete;
end
$function$;

create or replace function public.submit_assessment_answer_v1(
  p_attempt_id uuid,
  p_user_id uuid,
  p_generated_question_id uuid,
  p_selected_choice_id text
)
returns table (
  answer_id uuid,
  out_generated_question_id uuid,
  is_correct boolean,
  correct_choice_id text,
  question_type text,
  prompt text,
  testament text,
  scope_key text,
  assessment_mode text,
  answered_count integer,
  total_count integer,
  is_complete boolean
)
language sql
security definer
set search_path = public
as $function$
  select *
  from public.submit_assessment_answer_v2(
    p_attempt_id,
    p_user_id,
    p_generated_question_id,
    p_selected_choice_id
  );
$function$;

create or replace function public.obs_submit_ot_assessment_response(
  p_attempt_id uuid,
  p_generated_question_id uuid,
  p_response text
)
returns table (
  is_correct boolean,
  is_idk boolean,
  correct_choice_id text,
  answered_count integer,
  correct_count integer,
  target_question_count integer,
  target_reached boolean,
  remaining_count integer,
  assessment_kind text,
  unit_key text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_attempt record;
  v_question public.v_question_bank%rowtype;
  v_response_order jsonb;
  v_correct_order jsonb;
  v_choices jsonb;
  v_is_correct boolean;
  v_is_idk boolean;
  v_answered integer;
  v_correct integer;
  v_target integer;
  v_reached boolean;
  v_answer_id uuid;
  v_item_count integer;
  v_response_count integer;
  v_response_distinct integer;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  select
    attempt.id,
    attempt.assessment_kind,
    attempt.testament,
    attempt.scope_key,
    context.unit_key,
    greatest(
      1,
      coalesce(
        attempt.target_question_count,
        attempt.question_target,
        20
      )
    ) as target_count
  into v_attempt
  from public.assessment_attempts attempt
  left join public.obs_ot_attempt_context context
    on context.attempt_id = attempt.id
   and context.user_id = attempt.user_id
  where attempt.id = p_attempt_id
    and attempt.user_id = v_user_id
    and upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
  for update of attempt;

  if v_attempt.id is null then
    raise exception using
      errcode = '42501',
      message = 'Attempt not found or not authorized';
  end if;

  select question.*
  into v_question
  from public.v_question_bank question
  where question.generated_question_id = p_generated_question_id;

  if v_question.generated_question_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Question not found or inactive';
  end if;

  if not public.obs_is_order_response_question(
    v_question.question_type,
    v_question.payload
  ) then
    return query
    select *
    from public.obs_submit_ot_assessment_answer(
      p_attempt_id,
      p_generated_question_id,
      p_response
    );
    return;
  end if;

  if not public.question_matches_assessment_scope(
    v_question.book_code,
    v_attempt.testament,
    v_attempt.scope_key
  ) then
    raise exception using
      errcode = '22023',
      message = 'Question does not belong to attempt scope';
  end if;

  v_choices := v_question.payload->'choices';
  v_correct_order := v_question.payload->'correct_order';
  v_is_idk := upper(coalesce(p_response, '')) = '__IDK__';

  if jsonb_typeof(v_choices) <> 'array'
     or jsonb_typeof(v_correct_order) <> 'array'
     or jsonb_array_length(v_choices) not between 3 and 5
     or jsonb_array_length(v_correct_order) <> jsonb_array_length(v_choices)
  then
    raise exception using
      errcode = '22023',
      message = 'Sequence question payload is invalid';
  end if;

  if not v_is_idk then
    v_response_order := public.obs_parse_sequence_order(p_response);
    if v_response_order is null then
      raise exception using
        errcode = '22023',
        message = 'Sequence response is invalid';
    end if;

    v_item_count := jsonb_array_length(v_choices);
    select
      count(*)::integer,
      count(distinct response.item_id)::integer
    into v_response_count, v_response_distinct
    from jsonb_array_elements_text(v_response_order) response(item_id);

    if v_response_count <> v_item_count
       or v_response_distinct <> v_item_count
       or exists (
         select 1
         from jsonb_array_elements_text(v_response_order) response(item_id)
         where not exists (
           select 1
           from jsonb_array_elements(v_choices) choice
           where choice->>'id' = response.item_id
         )
       )
    then
      raise exception using
        errcode = '22023',
        message = 'Sequence response must contain every item exactly once';
    end if;
  end if;

  v_is_correct := not v_is_idk and v_response_order = v_correct_order;

  insert into public.assessment_answers (
    attempt_id,
    user_id,
    question_id,
    generated_question_id,
    selected_choice_id,
    is_correct,
    is_idk,
    answered_at
  ) values (
    p_attempt_id,
    v_user_id,
    p_generated_question_id,
    p_generated_question_id,
    p_response,
    v_is_correct,
    v_is_idk,
    now()
  )
  on conflict (attempt_id, question_id) do update set
    selected_choice_id = excluded.selected_choice_id,
    is_correct = excluded.is_correct,
    is_idk = excluded.is_idk,
    answered_at = excluded.answered_at,
    generated_question_id = excluded.generated_question_id,
    user_id = excluded.user_id
  returning id into v_answer_id;

  select
    count(*)::integer,
    count(*) filter (where answer.is_correct)::integer
  into v_answered, v_correct
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id
    and answer.user_id = v_user_id;

  v_target := v_attempt.target_count;
  v_reached := v_answered >= v_target;

  update public.assessment_attempts
  set
    answered_count = v_answered,
    correct_count = v_correct,
    is_complete = v_reached,
    completed_at = case
      when v_reached then coalesce(completed_at, now())
      else completed_at
    end
  where id = p_attempt_id;

  if v_question.event_id is not null and not v_is_idk then
    perform public.update_theta_internal(
      v_user_id,
      public.canonical_assessment_scope(v_question.book_code),
      v_question.event_id,
      v_is_correct
    );
    perform public.update_theta_internal(
      v_user_id,
      'OT',
      v_question.event_id,
      v_is_correct
    );
    perform public.update_theta_internal(
      v_user_id,
      'BIBLE',
      v_question.event_id,
      v_is_correct
    );
  end if;

  if v_reached
     and v_attempt.assessment_kind = 'ot_focused'
     and not exists (
       select 1
       from public.obs_study_plan_events event
       where event.user_id = v_user_id
         and event.attempt_id = p_attempt_id
         and event.event_type = 'retest_completed'
     )
  then
    insert into public.obs_study_plan_events (
      user_id,
      unit_key,
      event_type,
      attempt_id,
      metadata
    ) values (
      v_user_id,
      v_attempt.unit_key,
      'retest_completed',
      p_attempt_id,
      jsonb_build_object(
        'source',
        'focused_sequence_assessment_completion',
        'answered_count',
        v_answered,
        'correct_count',
        v_correct
      )
    );
  end if;

  return query
  select
    v_is_correct,
    v_is_idk,
    '__ORDER__:' || v_correct_order::text,
    v_answered,
    v_correct,
    v_target,
    v_reached,
    greatest(v_target - v_answered, 0),
    v_attempt.assessment_kind,
    v_attempt.unit_key;
end
$function$;

revoke all on function public.submit_assessment_answer_v2(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.submit_assessment_answer_v1(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.obs_submit_ot_assessment_response(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.submit_assessment_answer_v2(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.submit_assessment_answer_v1(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.obs_submit_ot_assessment_response(uuid, uuid, text)
  to service_role;

comment on function public.submit_assessment_answer_v2(uuid, uuid, uuid, text) is
  'Internal OT answer writer restored from repo source after the 2026-08-18 cleanup drop.';
comment on function public.submit_assessment_answer_v1(uuid, uuid, uuid, text) is
  'Compatibility wrapper delegating to submit_assessment_answer_v2; restored after the 2026-08-18 cleanup drop.';
comment on function public.obs_submit_ot_assessment_response(uuid, uuid, text) is
  'Internal OT answer response delegate used by obs_submit_ot_assessment_response_v2; restored with order-response helper support.';

do $postcondition$
declare
  v_v1_def text := lower(pg_get_functiondef(
    'public.submit_assessment_answer_v1(uuid,uuid,uuid,text)'::regprocedure
  ));
  v_response_def text := lower(pg_get_functiondef(
    'public.obs_submit_ot_assessment_response(uuid,uuid,text)'::regprocedure
  ));
begin
  if to_regprocedure('public.submit_assessment_answer_v2(uuid,uuid,uuid,text)') is null
     or to_regprocedure('public.submit_assessment_answer_v1(uuid,uuid,uuid,text)') is null
     or to_regprocedure('public.obs_submit_ot_assessment_response(uuid,uuid,text)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'OT submit-chain restore failed: expected functions are missing';
  end if;

  if v_v1_def not like '%submit_assessment_answer_v2%' then
    raise exception using
      errcode = 'P0001',
      message = 'submit_assessment_answer_v1 is no longer a v2 delegate';
  end if;

  if v_response_def not like '%obs_is_order_response_question%' then
    raise exception using
      errcode = 'P0001',
      message = 'obs_submit_ot_assessment_response lost order-response helper support';
  end if;

  if has_function_privilege(
       'anon',
       'public.obs_submit_ot_assessment_response(uuid,uuid,text)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.obs_submit_ot_assessment_response(uuid,uuid,text)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.submit_assessment_answer_v1(uuid,uuid,uuid,text)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.submit_assessment_answer_v2(uuid,uuid,uuid,text)',
       'execute'
     )
  then
    raise exception using
      errcode = 'P0001',
      message = 'OT submit-chain restore exposed lower-level delegates to client roles';
  end if;
end
$postcondition$;

notify pgrst, 'reload schema';

commit;
