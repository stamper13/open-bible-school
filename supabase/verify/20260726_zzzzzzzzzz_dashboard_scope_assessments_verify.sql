do $$
declare
  v_definition text;
  v_missing_scopes text;
begin
  if to_regprocedure(
       'public.obs_start_or_resume_ot_scope_assessment(text,text,integer,boolean)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Dashboard scope-assessment function is missing.';
  end if;

  select pg_get_functiondef(
    'public.obs_start_or_resume_ot_scope_assessment(text,text,integer,boolean)'::regprocedure
  )
  into v_definition;

  if strpos(v_definition, 'question_matches_assessment_scope') = 0
     or strpos(v_definition, 'assessment_kind = ''ot_adaptive''') = 0
     or strpos(v_definition, 'obs_ot_attempt_context') = 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'Scope assessment is missing canonical matching, adaptive routing, or safe resume isolation.';
  end if;

  with scope_counts as (
    select
      scope.scope_key,
      count(distinct question.generated_question_id)::integer as available
    from (
      values ('TORAH'), ('FORMER'), ('LATTER'), ('WRITINGS')
    ) scope(scope_key)
    left join public.v_question_bank question
      on public.question_matches_assessment_scope(
        question.book_code,
        'OT',
        scope.scope_key
      )
     and question.payload ? 'choices'
     and jsonb_typeof(question.payload->'choices') = 'array'
    group by scope.scope_key
  )
  select string_agg(scope_key, ', ' order by scope_key)
  into v_missing_scopes
  from scope_counts
  where available = 0;

  if v_missing_scopes is not null then
    raise exception using
      errcode = 'P0001',
      message = format(
        'No active assessment questions exist for canonical scopes: %s.',
        v_missing_scopes
      );
  end if;
end
$$;

select
  scope.scope_key,
  count(distinct question.generated_question_id)::integer as available_questions
from (
  values ('TORAH'), ('FORMER'), ('LATTER'), ('WRITINGS')
) scope(scope_key)
join public.v_question_bank question
  on public.question_matches_assessment_scope(
    question.book_code,
    'OT',
    scope.scope_key
  )
 and question.payload ? 'choices'
 and jsonb_typeof(question.payload->'choices') = 'array'
group by scope.scope_key
order by scope.scope_key;
