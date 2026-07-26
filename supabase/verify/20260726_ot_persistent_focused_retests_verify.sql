-- Verify persistent OT assessment and focused-retest objects.

do $$
declare
  required_function text;
begin
  if to_regclass('public.obs_ot_attempt_context') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Missing public.obs_ot_attempt_context';
  end if;

  foreach required_function in array array[
    'public.obs_start_or_resume_ot_assessment(text,text,integer,integer,integer,boolean)',
    'public.obs_get_ot_assessment_status(uuid)',
    'public.obs_get_next_ot_assessment_question(uuid)',
    'public.obs_submit_ot_assessment_answer(uuid,uuid,text)'
  ]
  loop
    if to_regprocedure(required_function) is null then
      raise exception using
        errcode = 'P0001',
        message = format('Missing required function: %s', required_function);
    end if;
  end loop;
end;
$$;

do $$
begin
  if has_table_privilege('anon', 'public.obs_ot_attempt_context', 'SELECT') then
    raise exception using
      errcode = 'P0001',
      message = 'anon must not read focused-attempt context';
  end if;

  if has_function_privilege(
    'anon',
    'public.obs_get_next_ot_assessment_question(uuid)',
    'EXECUTE'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'anon must not execute the persistent OT question RPC';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.obs_start_or_resume_ot_assessment(text,text,integer,integer,integer,boolean)',
    'EXECUTE'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'authenticated must execute the persistent OT start RPC';
  end if;
end;
$$;

do $$
declare
  units_without_questions integer;
begin
  select count(*)::integer
  into units_without_questions
  from public.obs_learning_units unit
  where not exists (
    select 1
    from public.obs_question_bank_with_units question
    where question.unit_key = unit.unit_key
      and question.generated_question_id is not null
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and jsonb_array_length(question.payload->'choices') >= 2
  );

  if units_without_questions > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        '%s learning units have no focused-retest questions',
        units_without_questions
      );
  end if;
end;
$$;

select
  unit.unit_key,
  unit.label,
  unit.retest_question_target,
  count(distinct question.generated_question_id)::integer as available_questions
from public.obs_learning_units unit
left join public.obs_question_bank_with_units question
  on question.unit_key = unit.unit_key
 and question.payload ? 'choices'
 and jsonb_typeof(question.payload->'choices') = 'array'
group by unit.unit_key, unit.label, unit.sequence_order, unit.retest_question_target
order by unit.sequence_order;

select
  'PASS: persistent OT assessments and focused retests are installed'
    as verification_result;
