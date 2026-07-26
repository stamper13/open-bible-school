do $$
declare
  context_column_count integer;
  genesis_character_questions integer;
  genesis_geography_questions integer;
  selector_definition text;
begin
  if to_regprocedure(
       'public.obs_get_user_recommendation_v2(uuid)'
     ) is null
     or to_regprocedure(
       'public.obs_get_next_focused_question_v2(uuid,uuid,text,text,integer,integer,text)'
     ) is null
     or to_regprocedure(
       'public.obs_start_or_resume_ot_assessment_v2(text,text,integer,integer,integer,boolean,text)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'FAIL: one or more dimension-aware RPCs are missing.';
  end if;

  select count(*)
  into context_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'obs_ot_attempt_context'
    and column_name = 'dimension_key';

  select count(distinct question.generated_question_id)
  into genesis_character_questions
  from public.obs_question_bank_with_units question
  where question.book_code = 'GEN'
    and question.dimension_key = 'characters_lineage';

  select count(distinct question.generated_question_id)
  into genesis_geography_questions
  from public.obs_question_bank_with_units question
  where question.book_code = 'GEN'
    and question.dimension_key = 'geography_nations';

  select pg_get_functiondef(
    'public.obs_get_next_ot_assessment_question(uuid)'::regprocedure
  )
  into selector_definition;

  if context_column_count <> 1
     or genesis_character_questions < 8
     or genesis_geography_questions < 8
     or selector_definition not like
       '%public.obs_get_next_focused_question_v2(%'
     or selector_definition not like '%attempt.dimension_key%'
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'FAIL: context_column=%s Genesis characters=%s geography=%s selector_rewired=%s.',
        context_column_count,
        genesis_character_questions,
        genesis_geography_questions,
        selector_definition like '%public.obs_get_next_focused_question_v2(%'
      );
  end if;

  raise notice
    'PASS: dimension-aware recommendation and retest RPCs are installed; Genesis has % character and % geography questions.',
    genesis_character_questions,
    genesis_geography_questions;
end
$$;

select
  unit_key,
  dimension_key,
  count(distinct generated_question_id)::integer as available_questions
from public.obs_question_bank_with_units
where unit_key in ('gen-1-11', 'gen-12-50')
group by unit_key, dimension_key
order by unit_key, available_questions desc;
