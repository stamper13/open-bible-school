do $$
begin
  if not has_function_privilege(
    'authenticated',
    'public.obs_get_next_ot_assessment_question(uuid)',
    'execute'
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'FAIL: authenticated cannot execute obs_get_next_ot_assessment_question(uuid).';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.obs_submit_ot_assessment_response(uuid,uuid,text)',
    'execute'
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'FAIL: authenticated cannot execute obs_submit_ot_assessment_response(uuid,uuid,text).';
  end if;
end
$$;

do $$
declare
  active_count integer;
  invalid_payload_count integer;
  unshuffled_count integer;
  wrong_dimension_count integer;
  blocker_count integer;
  selector_definition text;
  submit_definition text;
  review_definition text;
begin
  if to_regprocedure(
       'public.obs_parse_sequence_order(text)'
     ) is null
     or to_regprocedure(
       'public.obs_submit_ot_assessment_response(uuid,uuid,text)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: sequence parser or submission RPC is missing.';
  end if;

  select count(*)
  into active_count
  from public.ot_generated_questions question
  where question.question_type = 'sequence_order_v1'
    and question.dedupe_key like 'sequence|%';

  select count(*)
  into invalid_payload_count
  from public.ot_generated_questions question
  where question.question_type = 'sequence_order_v1'
    and question.dedupe_key like 'sequence|%'
    and (
      jsonb_typeof(question.payload->'choices') <> 'array'
      or jsonb_typeof(question.payload->'correct_order') <> 'array'
      or jsonb_array_length(question.payload->'choices') <> 4
      or jsonb_array_length(question.payload->'correct_order') <> 4
      or (
        select count(distinct choice->>'id')
        from jsonb_array_elements(question.payload->'choices') choice
      ) <> 4
      or (
        select count(distinct ordered.item_id)
        from jsonb_array_elements_text(
          question.payload->'correct_order'
        ) ordered(item_id)
      ) <> 4
      or exists (
        select 1
        from jsonb_array_elements_text(
          question.payload->'correct_order'
        ) ordered(item_id)
        where not exists (
          select 1
          from jsonb_array_elements(question.payload->'choices') choice
          where choice->>'id' = ordered.item_id
        )
      )
    );

  select count(*)
  into unshuffled_count
  from public.ot_generated_questions question
  where question.question_type = 'sequence_order_v1'
    and question.dedupe_key like 'sequence|%'
    and (
      select jsonb_agg(choice.item->>'id' order by choice.ordinality)
      from jsonb_array_elements(question.payload->'choices')
        with ordinality choice(item, ordinality)
    ) = question.payload->'correct_order';

  select count(*)
  into wrong_dimension_count
  from public.obs_question_bank_with_dimensions question
  where question.question_type = 'sequence_order_v1'
    and question.dimension_key is distinct from 'events_timeline';

  select count(*)
  into blocker_count
  from public.obs_admin_question_bank_audit audit
  where audit.question_type = 'sequence_order_v1'
    and cardinality(audit.blocker_reasons) > 0;

  select pg_get_functiondef(
    'public.get_next_scoped_assessment_question(uuid,uuid)'::regprocedure
  )
  into selector_definition;
  select pg_get_functiondef(
    'public.obs_submit_ot_assessment_response(uuid,uuid,text)'::regprocedure
  )
  into submit_definition;
  select pg_get_functiondef(
    'public.obs_get_attempt_review(uuid,uuid)'::regprocedure
  )
  into review_definition;

  if active_count <> 6
     or invalid_payload_count <> 0
     or unshuffled_count <> 0
     or wrong_dimension_count <> 0
     or blocker_count <> 0
     or selector_definition not like '%sequence_order_v1%'
     or submit_definition not like '%v_response_order = v_correct_order%'
     or review_definition not like '%obs_parse_sequence_order%'
     or not exists (
       select 1
       from pg_constraint constraint_row
       where constraint_row.conrelid = 'public.assessment_answers'::regclass
         and constraint_row.conname =
           'assessment_answers_selected_choice_id_check'
         and pg_get_constraintdef(constraint_row.oid)
           like '%obs_parse_sequence_order%'
     )
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'FAIL: active=%s invalid=%s unshuffled=%s wrong_dimension=%s blockers=%s selector=%s submit=%s review=%s.',
        active_count,
        invalid_payload_count,
        unshuffled_count,
        wrong_dimension_count,
        blocker_count,
        selector_definition like '%sequence_order_v1%',
        submit_definition like '%v_response_order = v_correct_order%',
        review_definition like '%obs_parse_sequence_order%'
      );
  end if;

  raise notice
    'PASS: six valid, shuffled Events & Timeline sequence questions are routable, gradable, and reviewable.';
end
$$;

select
  question.payload->>'book_code' as book_code,
  question.payload->>'prompt' as prompt,
  question.payload->>'reference' as reference,
  audit.router_eligible,
  audit.blocker_reasons
from public.ot_generated_questions question
join public.obs_admin_question_bank_audit audit
  on audit.generated_question_id = question.id
where question.question_type = 'sequence_order_v1'
order by question.payload->>'book_code', question.dedupe_key;
