-- Make the frontend OT submission RPC first-write-wins and retry-safe.
-- The attempt row lock serializes concurrent submissions for one assessment.

begin;

do $$
declare
  v_oid oid;
  v_definition text;
  v_anchor text;
  v_replacement text;
  v_occurrences integer;
begin
  v_oid := to_regprocedure(
    'public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)'
  );

  if v_oid is null then
    raise exception using
      errcode = 'P0001',
      message = 'OT submission V2 RPC is missing';
  end if;

  insert into public.obs_schema_backups (
    backup_tag,
    object_schema,
    object_name,
    object_type,
    definition
  )
  select
    '20260731_ot_submission_idempotency',
    'public',
    'obs_submit_ot_assessment_response_v2',
    'function',
    pg_get_functiondef(v_oid)
  where not exists (
    select 1
    from public.obs_schema_backups backup
    where backup.backup_tag = '20260731_ot_submission_idempotency'
      and backup.object_schema = 'public'
      and backup.object_name = 'obs_submit_ot_assessment_response_v2'
      and backup.object_type = 'function'
  );

  select count(*)
  into v_occurrences
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260731_ot_submission_idempotency'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_submit_ot_assessment_response_v2'
    and backup.object_type = 'function';

  if v_occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected exactly one OT submission backup; found %s',
        v_occurrences
      );
  end if;

  v_definition := pg_get_functiondef(v_oid);

  v_anchor := $patch$  v_semantic_is_correct boolean;
  v_is_sequence boolean;
  v_is_idk boolean;
begin$patch$;
  v_replacement := $patch$  v_semantic_is_correct boolean;
  v_is_sequence boolean;
  v_is_idk boolean;
  v_existing record;
  v_answered integer;
  v_correct integer;
  v_target integer;
begin$patch$;

  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);

  if v_occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'OT idempotency declaration anchor mismatch; found %s',
        v_occurrences
      );
  end if;

  v_definition := replace(v_definition, v_anchor, v_replacement);

  v_anchor := $patch$  select *
  into v_result
  from public.obs_submit_ot_assessment_response(
    p_attempt_id,
    p_generated_question_id,
    v_canonical_selected_id
  );$patch$;

  v_replacement := $patch$  -- Serialize answer creation so simultaneous requests cannot race past
  -- the first-write check and replace one another.
  perform 1
  from public.assessment_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = auth.uid()
    and upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
  for update;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Attempt not found or not authorized';
  end if;

  select
    answer.id,
    answer.selected_choice_id,
    answer.selected_choice_text_snapshot,
    answer.delivered_choices_snapshot,
    answer.correct_choice_id_snapshot,
    answer.is_correct,
    coalesce(answer.is_idk, false) as is_idk,
    attempt.assessment_kind,
    context.unit_key,
    greatest(
      1,
      coalesce(
        attempt.target_question_count,
        attempt.question_target,
        20
      )
    ) as target_count
  into v_existing
  from public.assessment_answers answer
  join public.assessment_attempts attempt
    on attempt.id = answer.attempt_id
   and attempt.user_id = answer.user_id
  left join public.obs_ot_attempt_context context
    on context.attempt_id = attempt.id
   and context.user_id = attempt.user_id
  where answer.attempt_id = p_attempt_id
    and answer.generated_question_id = p_generated_question_id
    and answer.user_id = auth.uid()
  limit 1;

  if v_existing.id is not null then
    if v_existing.selected_choice_id is distinct from p_response
      or v_existing.selected_choice_text_snapshot
        is distinct from p_selected_choice_text
      or v_existing.delivered_choices_snapshot
        is distinct from p_displayed_choices
    then
      raise exception using
        errcode = '22023',
        message = 'Question already answered; the recorded response cannot be changed';
    end if;

    select
      count(*)::integer,
      count(*) filter (where answer.is_correct)::integer
    into v_answered, v_correct
    from public.assessment_answers answer
    where answer.attempt_id = p_attempt_id
      and answer.user_id = auth.uid();

    v_target := v_existing.target_count;

    return query
    select
      v_existing.is_correct,
      v_existing.is_idk,
      v_existing.correct_choice_id_snapshot,
      v_answered,
      v_correct,
      v_target,
      v_answered >= v_target,
      greatest(v_target - v_answered, 0),
      v_existing.assessment_kind,
      v_existing.unit_key;
    return;
  end if;

  select *
  into v_result
  from public.obs_submit_ot_assessment_response(
    p_attempt_id,
    p_generated_question_id,
    v_canonical_selected_id
  );$patch$;

  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor);

  if v_occurrences <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'OT idempotency submission anchor mismatch; found %s',
        v_occurrences
      );
  end if;

  execute replace(v_definition, v_anchor, v_replacement);
end;
$$;

revoke all on function public.obs_submit_ot_assessment_response_v2(
  uuid, uuid, text, text, jsonb
) from public, anon;
grant execute on function public.obs_submit_ot_assessment_response_v2(
  uuid, uuid, text, text, jsonb
) to authenticated, service_role;

comment on function public.obs_submit_ot_assessment_response_v2(
  uuid, uuid, text, text, jsonb
) is
  'Validates delivered OT choices and records the first response exactly once; exact retries return the original result.';

notify pgrst, 'reload schema';

commit;
