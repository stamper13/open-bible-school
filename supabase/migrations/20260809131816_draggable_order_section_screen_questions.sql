-- Convert section-screen sequence MCQs into true draggable order-response items.
--
-- The router should continue to treat these as section_screen_mcq_v1 items, but
-- the answer UI and scorer should treat payloads with a valid correct_order as
-- ordered-response questions. This avoids recording an arbitrary A/B/C/D
-- distractor when a learner drags an order that was not one of the old MCQ
-- permutations.

begin;

create or replace function public.obs_is_order_response_question(
  p_question_type text,
  p_payload jsonb
)
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $$
  select
    coalesce(p_question_type, '') = 'sequence_order_v1'
    or (
      jsonb_typeof(p_payload->'choices') = 'array'
      and jsonb_typeof(p_payload->'correct_order') = 'array'
      and jsonb_array_length(p_payload->'choices') between 3 and 5
      and jsonb_array_length(p_payload->'correct_order')
        = jsonb_array_length(p_payload->'choices')
    );
$$;

comment on function public.obs_is_order_response_question(text, jsonb) is
  'Returns true for OT questions that should be answered with an ordered __ORDER__ response.';

revoke all on function public.obs_is_order_response_question(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.obs_is_order_response_question(text, jsonb)
  to service_role;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260809131816_draggable_order_section_screen_questions',
  'public',
  backup.object_name,
  'function',
  pg_get_functiondef(backup.oid)
from (
  select
    p.oid,
    p.proname as object_name
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'obs_capture_answer_delivery_snapshot',
      'trg_guard_distractor_quality',
      'obs_submit_ot_assessment_response',
      'obs_submit_ot_assessment_response_v2',
      'obs_get_attempt_review'
    )
) backup
where not exists (
  select 1
  from public.obs_schema_backups existing
  where existing.backup_tag =
      '20260809131816_draggable_order_section_screen_questions'
    and existing.object_schema = 'public'
    and existing.object_name = backup.object_name
    and existing.object_type = 'function'
);

do $$
declare
  v_definition text;
  v_occurrences integer;
begin
  if to_regprocedure('public.obs_capture_answer_delivery_snapshot()') is null then
    raise exception 'Missing public.obs_capture_answer_delivery_snapshot()';
  end if;

  v_definition :=
    pg_get_functiondef('public.obs_capture_answer_delivery_snapshot()'::regprocedure);

  v_definition := replace(
    v_definition,
    'when v_question.question_type = ''sequence_order_v1''',
    'when public.obs_is_order_response_question(v_question.question_type, v_question.payload)'
  );
  v_definition := replace(
    v_definition,
    'if v_question.question_type = ''sequence_order_v1'' then',
    'if public.obs_is_order_response_question(v_question.question_type, v_question.payload) then'
  );

  if v_definition =
     pg_get_functiondef('public.obs_capture_answer_delivery_snapshot()'::regprocedure)
  then
    raise exception 'Did not patch public.obs_capture_answer_delivery_snapshot()';
  end if;

  execute v_definition;

  if to_regprocedure('public.trg_guard_distractor_quality()') is not null then
    v_definition :=
      pg_get_functiondef('public.trg_guard_distractor_quality()'::regprocedure);

    v_occurrences := (
      length(v_definition)
      - length(replace(
        v_definition,
        'coalesce(new.question_type, '''') = ''sequence_order_v1''',
        ''
      ))
    ) / length('coalesce(new.question_type, '''') = ''sequence_order_v1''');

    if v_occurrences <> 1 then
      raise exception
        'Unexpected distractor guard sequence anchor count: %',
        v_occurrences;
    end if;

    v_definition := replace(
      v_definition,
      'coalesce(new.question_type, '''') = ''sequence_order_v1''',
      'public.obs_is_order_response_question(new.question_type, new.payload)'
    );

    execute v_definition;
  end if;

  if to_regprocedure('public.obs_submit_ot_assessment_response(uuid,uuid,text)') is null then
    raise exception 'Missing public.obs_submit_ot_assessment_response(uuid,uuid,text)';
  end if;

  v_definition :=
    pg_get_functiondef('public.obs_submit_ot_assessment_response(uuid,uuid,text)'::regprocedure);

  v_occurrences := (
    length(v_definition)
    - length(replace(
      v_definition,
      'if v_question.question_type <> ''sequence_order_v1'' then',
      ''
    ))
  ) / length('if v_question.question_type <> ''sequence_order_v1'' then');

  if v_occurrences <> 1 then
    raise exception
      'Unexpected core submit sequence anchor count: %',
      v_occurrences;
  end if;

  v_definition := replace(
    v_definition,
    'if v_question.question_type <> ''sequence_order_v1'' then',
    'if not public.obs_is_order_response_question(v_question.question_type, v_question.payload) then'
  );

  execute v_definition;

  if to_regprocedure('public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)') is null then
    raise exception 'Missing public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)';
  end if;

  v_definition :=
    pg_get_functiondef('public.obs_submit_ot_assessment_response_v2(uuid,uuid,text,text,jsonb)'::regprocedure);

  v_occurrences := (
    length(v_definition)
    - length(replace(
      v_definition,
      'v_is_sequence := v_question.question_type = ''sequence_order_v1'';',
      ''
    ))
  ) / length('v_is_sequence := v_question.question_type = ''sequence_order_v1'';');

  if v_occurrences <> 1 then
    raise exception
      'Unexpected V2 submit sequence anchor count: %',
      v_occurrences;
  end if;

  v_definition := replace(
    v_definition,
    'v_is_sequence := v_question.question_type = ''sequence_order_v1'';',
    'v_is_sequence := public.obs_is_order_response_question(v_question.question_type, v_question.payload);'
  );

  execute v_definition;

  if to_regprocedure('public.obs_get_attempt_review(uuid,uuid)') is not null then
    v_definition :=
      pg_get_functiondef('public.obs_get_attempt_review(uuid,uuid)'::regprocedure);

    v_definition := replace(
      v_definition,
      'evidence.question_type <> ''sequence_order_v1''',
      'not public.obs_is_order_response_question(evidence.question_type, evidence.payload)'
    );
    v_definition := replace(
      v_definition,
      'review.question_type = ''sequence_order_v1''',
      'public.obs_is_order_response_question(review.question_type, review.display_payload)'
    );

    execute v_definition;
  end if;
end;
$$;

update public.ot_generated_questions question
set payload =
  question.payload
  || jsonb_build_object(
    'legacy_sequence_mcq_choices',
      coalesce(question.payload->'legacy_sequence_mcq_choices', question.payload->'choices'),
    'choices',
      jsonb_build_array(
        jsonb_build_object('id', 'A', 'text', 'Patriarchs'),
        jsonb_build_object('id', 'B', 'text', 'slavery in Egypt'),
        jsonb_build_object('id', 'C', 'text', 'Sinai'),
        jsonb_build_object('id', 'D', 'text', 'wilderness journey')
      ),
    'correct_order',
      jsonb_build_array('A', 'B', 'C', 'D'),
    'interaction_type',
      'drag_order_v1',
    'correct_answer',
      'Patriarchs, slavery in Egypt, Sinai, wilderness journey'
  )
where question.id = '55811768-6959-4c26-9e4a-30433f4885ee'::uuid
  and question.question_type = 'section_screen_mcq_v1';

update public.ot_generated_questions question
set payload =
  question.payload
  || jsonb_build_object(
    'legacy_sequence_mcq_choices',
      coalesce(question.payload->'legacy_sequence_mcq_choices', question.payload->'choices'),
    'choices',
      jsonb_build_array(
        jsonb_build_object('id', 'A', 'text', 'Conquest'),
        jsonb_build_object('id', 'B', 'text', 'judges'),
        jsonb_build_object('id', 'C', 'text', 'united monarchy'),
        jsonb_build_object('id', 'D', 'text', 'divided monarchy')
      ),
    'correct_order',
      jsonb_build_array('A', 'B', 'C', 'D'),
    'interaction_type',
      'drag_order_v1',
    'correct_answer',
      'Conquest, judges, united monarchy, divided monarchy'
  )
where question.id = '519d832e-5122-449b-8691-1579f232c6cd'::uuid
  and question.question_type = 'section_screen_mcq_v1';

update public.ot_generated_questions question
set payload =
  question.payload
  || jsonb_build_object(
    'legacy_sequence_mcq_choices',
      coalesce(question.payload->'legacy_sequence_mcq_choices', question.payload->'choices'),
    'choices',
      jsonb_build_array(
        jsonb_build_object('id', 'A', 'text', 'Creation'),
        jsonb_build_object('id', 'B', 'text', 'call of Abraham'),
        jsonb_build_object('id', 'C', 'text', 'exodus from Egypt'),
        jsonb_build_object('id', 'D', 'text', 'covenant at Sinai')
      ),
    'correct_order',
      jsonb_build_array('A', 'B', 'C', 'D'),
    'interaction_type',
      'drag_order_v1',
    'correct_answer',
      'Creation, call of Abraham, exodus from Egypt, covenant at Sinai'
  )
where question.id = 'a6d83922-dc39-488d-80d3-4c50cd4b1ceb'::uuid
  and question.question_type = 'section_screen_mcq_v1';

do $$
declare
  v_converted integer;
  v_invalid integer;
begin
  select count(*)
  into v_converted
  from public.ot_generated_questions question
  where question.id in (
      '55811768-6959-4c26-9e4a-30433f4885ee'::uuid,
      '519d832e-5122-449b-8691-1579f232c6cd'::uuid,
      'a6d83922-dc39-488d-80d3-4c50cd4b1ceb'::uuid
    )
    and public.obs_is_order_response_question(
      question.question_type,
      question.payload
    );

  if v_converted <> 3 then
    raise exception 'Expected 3 converted section-screen order questions, found %', v_converted;
  end if;

  select count(*)
  into v_invalid
  from public.ot_generated_questions question
  where public.obs_is_order_response_question(
      question.question_type,
      question.payload
    )
    and (
      select count(distinct choice->>'id')
      from jsonb_array_elements(question.payload->'choices') choice
    ) <> jsonb_array_length(question.payload->'choices');

  if v_invalid <> 0 then
    raise exception 'Order-response question choices contain duplicate IDs';
  end if;
end;
$$;

revoke all on function public.obs_capture_answer_delivery_snapshot()
  from public, anon, authenticated;

revoke all on function public.obs_submit_ot_assessment_response(
  uuid, uuid, text
) from public, anon;
grant execute on function public.obs_submit_ot_assessment_response(
  uuid, uuid, text
) to authenticated, service_role;

revoke all on function public.obs_submit_ot_assessment_response_v2(
  uuid, uuid, text, text, jsonb
) from public, anon;
grant execute on function public.obs_submit_ot_assessment_response_v2(
  uuid, uuid, text, text, jsonb
) to authenticated, service_role;

revoke all on function public.obs_get_attempt_review(uuid, uuid)
  from public, anon;
grant execute on function public.obs_get_attempt_review(uuid, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
