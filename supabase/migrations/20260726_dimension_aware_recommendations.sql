-- Add dimension-aware reading recommendations and focused OT retests.
--
-- The recommendation pyramid still selects the earliest weak learning unit.
-- Inside that unit, it may recommend a dimension only when the user has at
-- least three answers in it and the bank has at least eight distinct questions.

begin;

do $$
begin
  if to_regclass('public.obs_ot_attempt_context') is null
     or to_regclass('public.obs_learning_units') is null
     or to_regclass('public.obs_bli_dimensions') is null
     or to_regclass('public.obs_question_bank_with_units') is null
     or to_regclass('public.obs_schema_backups') is null
     or to_regprocedure(
       'public.obs_start_or_resume_ot_assessment(text,text,integer,integer,integer,boolean)'
     ) is null
     or to_regprocedure(
       'public.obs_get_next_ot_assessment_question(uuid)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Required recommendation, dimension, focused-assessment, or backup objects are missing.';
  end if;
end
$$;

insert into public.obs_schema_backups (
  backup_tag,
  object_schema,
  object_name,
  object_type,
  definition
)
select
  '20260726_dimension_aware_recommendations',
  'public',
  'obs_get_next_ot_assessment_question',
  'function',
  pg_get_functiondef(
    'public.obs_get_next_ot_assessment_question(uuid)'::regprocedure
  )
where not exists (
  select 1
  from public.obs_schema_backups backup
  where backup.backup_tag = '20260726_dimension_aware_recommendations'
    and backup.object_schema = 'public'
    and backup.object_name = 'obs_get_next_ot_assessment_question'
    and backup.object_type = 'function'
);

do $$
declare
  backup_count integer;
begin
  select count(*)
  into backup_count
  from public.obs_schema_backups
  where backup_tag = '20260726_dimension_aware_recommendations'
    and object_schema = 'public'
    and object_name = 'obs_get_next_ot_assessment_question'
    and object_type = 'function';

  if backup_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format('Expected one focused-selector backup, found %s.', backup_count);
  end if;
end
$$;

alter table public.obs_ot_attempt_context
  add column dimension_key text
  references public.obs_bli_dimensions(dimension_key)
  on delete restrict;

create index obs_ot_attempt_context_user_unit_dimension_idx
  on public.obs_ot_attempt_context (
    user_id,
    unit_key,
    dimension_key,
    created_at desc
  );

create or replace function public.obs_get_user_recommendation_v2(
  p_user_id uuid
)
returns table (
  unit_key text,
  label text,
  section text,
  book_code text,
  start_chapter integer,
  end_chapter integer,
  sequence_order integer,
  is_foundation boolean,
  answered integer,
  correct integer,
  raw_score numeric,
  display_score integer,
  baseline_display_score_required integer,
  retest_question_target integer,
  focus_text text,
  reason text,
  recommendation_kind text,
  dimension_key text,
  dimension_label text,
  dimension_short_label text,
  dimension_answered integer,
  dimension_correct integer,
  dimension_display_score integer,
  dimension_available_questions integer,
  dimension_focus_text text
)
language sql
security definer
set search_path = public
as $$
  with authorized as (
    select 1
    where auth.uid() = p_user_id
  ),
  unit_answer_rows as (
    select
      unit.unit_key,
      unit.label,
      unit.section,
      unit.book_code,
      unit.start_chapter,
      unit.end_chapter,
      unit.sequence_order,
      unit.is_foundation,
      unit.baseline_display_score_required,
      unit.min_answers_required,
      unit.retest_question_target,
      unit.focus_text,
      answer.id as answer_id,
      coalesce(answer.is_correct, false) as is_correct,
      greatest(
        1,
        coalesce(
          question.routing_score,
          question.importance_conceptual,
          question.importance_context,
          50
        )
      )::numeric as weight
    from public.obs_learning_units unit
    join authorized on true
    left join public.obs_question_bank_with_units question
      on question.unit_key = unit.unit_key
    left join public.assessment_answers answer
      on answer.generated_question_id = question.generated_question_id
     and answer.user_id = p_user_id
     and not coalesce(answer.is_idk, false)
  ),
  unit_scores as (
    select
      unit_key,
      label,
      section,
      book_code,
      start_chapter,
      end_chapter,
      sequence_order,
      is_foundation,
      baseline_display_score_required,
      min_answers_required,
      retest_question_target,
      focus_text,
      count(answer_id)::integer as answered,
      count(answer_id) filter (where is_correct)::integer as correct,
      case
        when coalesce(
          sum(weight) filter (where answer_id is not null),
          0
        ) <= 0 then null
        else greatest(
          0,
          least(
            100,
            (
              (
                coalesce(
                  sum(weight) filter (
                    where answer_id is not null and is_correct
                  ),
                  0
                )
                / nullif(
                  sum(weight) filter (where answer_id is not null),
                  0
                )
              ) - 0.25
            ) / 0.75 * 100
          )
        )
      end as raw_score
    from unit_answer_rows
    group by
      unit_key,
      label,
      section,
      book_code,
      start_chapter,
      end_chapter,
      sequence_order,
      is_foundation,
      baseline_display_score_required,
      min_answers_required,
      retest_question_target,
      focus_text
  ),
  scored_units as (
    select
      unit_score.*,
      case
        when raw_score is null then null
        else public.obs_display_score_from_raw(raw_score)
      end as display_score
    from unit_scores unit_score
  ),
  foundation_gap as (
    select
      scored.*,
      case
        when answered < min_answers_required
          then 'Foundational unit needs more evidence'
        else 'Foundational unit is below baseline'
      end as unit_reason
    from scored_units scored
    where is_foundation
      and (
        answered < min_answers_required
        or coalesce(display_score, 200) < baseline_display_score_required
      )
    order by sequence_order
    limit 1
  ),
  later_gap as (
    select
      scored.*,
      case
        when answered < min_answers_required
          then 'Later or Writings unit needs more evidence'
        else 'Lowest post-foundation score'
      end as unit_reason
    from scored_units scored
    where not is_foundation
      and (
        answered < min_answers_required
        or coalesce(display_score, 200) < baseline_display_score_required
      )
    order by
      case when answered < min_answers_required then 0 else 1 end,
      coalesce(display_score, 200),
      sequence_order
    limit 1
  ),
  selected_unit as (
    select * from foundation_gap
    union all
    select * from later_gap
    where not exists (select 1 from foundation_gap)
    limit 1
  ),
  dimension_answer_rows as (
    select
      selected.unit_key,
      dimension.dimension_key,
      dimension.label as dimension_label,
      dimension.short_label as dimension_short_label,
      dimension.description as dimension_focus_text,
      dimension.sort_order,
      count(distinct coalesce(
        nullif(question.payload->>'stem_family', ''),
        question.generated_question_id::text
      ))::integer as available_questions,
      count(answer.id)::integer as answered,
      count(answer.id) filter (where answer.is_correct)::integer as correct,
      case
        when coalesce(
          sum(
            greatest(
              1,
              coalesce(
                question.routing_score,
                question.importance_conceptual,
                question.importance_context,
                50
              )
            )::numeric
          ) filter (where answer.id is not null),
          0
        ) <= 0 then null
        else greatest(
          0,
          least(
            100,
            (
              (
                coalesce(
                  sum(
                    greatest(
                      1,
                      coalesce(
                        question.routing_score,
                        question.importance_conceptual,
                        question.importance_context,
                        50
                      )
                    )::numeric
                  ) filter (
                    where answer.id is not null and answer.is_correct
                  ),
                  0
                )
                / nullif(
                  sum(
                    greatest(
                      1,
                      coalesce(
                        question.routing_score,
                        question.importance_conceptual,
                        question.importance_context,
                        50
                      )
                    )::numeric
                  ) filter (where answer.id is not null),
                  0
                )
              ) - 0.25
            ) / 0.75 * 100
          )
        )
      end as raw_score
    from selected_unit selected
    join public.obs_question_bank_with_units question
      on question.unit_key = selected.unit_key
    join public.obs_bli_dimensions dimension
      on dimension.dimension_key = question.dimension_key
     and not dimension.is_advanced
    left join public.assessment_answers answer
      on answer.generated_question_id = question.generated_question_id
     and answer.user_id = p_user_id
     and not coalesce(answer.is_idk, false)
    group by
      selected.unit_key,
      dimension.dimension_key,
      dimension.label,
      dimension.short_label,
      dimension.description,
      dimension.sort_order
  ),
  scored_dimensions as (
    select
      dimension.*,
      case
        when raw_score is null then null
        else public.obs_display_score_from_raw(raw_score)
      end as display_score
    from dimension_answer_rows dimension
  ),
  selected_dimension as (
    select dimension.*
    from scored_dimensions dimension
    cross join selected_unit selected
    where dimension.available_questions >= 8
      and dimension.answered >= 3
      and coalesce(dimension.display_score, 800)
        < selected.baseline_display_score_required
    order by
      dimension.display_score,
      dimension.answered desc,
      dimension.sort_order
    limit 1
  )
  select
    selected.unit_key,
    selected.label,
    selected.section,
    selected.book_code,
    selected.start_chapter,
    selected.end_chapter,
    selected.sequence_order,
    selected.is_foundation,
    selected.answered,
    selected.correct,
    selected.raw_score,
    selected.display_score,
    selected.baseline_display_score_required,
    case
      when dimension.dimension_key is null
        then selected.retest_question_target
      else least(
        selected.retest_question_target,
        dimension.available_questions
      )
    end,
    selected.focus_text,
    case
      when dimension.dimension_key is null then selected.unit_reason
      else 'Weakest well-supported dimension inside the earliest priority unit'
    end,
    case
      when dimension.dimension_key is null then 'UNIT'
      else 'DIMENSION'
    end,
    dimension.dimension_key,
    dimension.dimension_label,
    dimension.dimension_short_label,
    dimension.answered,
    dimension.correct,
    dimension.display_score,
    dimension.available_questions,
    dimension.dimension_focus_text
  from selected_unit selected
  left join selected_dimension dimension on true;
$$;

create or replace function public.obs_get_next_focused_question_v2(
  p_user_id uuid,
  p_attempt_id uuid,
  p_unit_key text default null,
  p_book_code text default null,
  p_start_chapter integer default null,
  p_end_chapter integer default null,
  p_dimension_key text default null
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  event_title text,
  book_code text,
  importance_tier integer,
  section text
)
language sql
security definer
set search_path = public
as $$
  with authorized as (
    select 1
    where auth.uid() = p_user_id
  ),
  target as (
    select
      unit.*,
      dimension.short_label as dimension_short_label
    from public.obs_learning_units unit
    join authorized on true
    left join public.obs_bli_dimensions dimension
      on dimension.dimension_key =
        public.obs_normalize_dimension_key(p_dimension_key)
    where (
      p_unit_key is not null
      and unit.unit_key = p_unit_key
    )
    or (
      p_unit_key is null
      and p_book_code is not null
      and unit.book_code = upper(p_book_code)
      and unit.start_chapter = p_start_chapter
      and unit.end_chapter = p_end_chapter
    )
    order by unit.sequence_order
    limit 1
  ),
  candidate_base as (
    select
      question.*,
      case
        when target.dimension_short_label is null
          then coalesce(
            target.label,
            question.unit_label,
            question.book_code || ' focused retest'
          )
        else target.dimension_short_label || ' in ' || target.label
      end as target_label,
      coalesce(
        target.section,
        question.unit_section,
        'Old Testament'
      ) as target_section,
      exists (
        select 1
        from public.assessment_answers answer
        where answer.user_id = p_user_id
          and answer.generated_question_id = question.generated_question_id
          and answer.attempt_id = p_attempt_id
      ) as answered_in_attempt,
      exists (
        select 1
        from public.assessment_answers answer
        where answer.user_id = p_user_id
          and answer.generated_question_id = question.generated_question_id
      ) as answered_before
    from public.obs_question_bank_with_units question
    join authorized on true
    left join target on true
    where question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and (
        p_dimension_key is null
        or question.dimension_key =
          public.obs_normalize_dimension_key(p_dimension_key)
      )
      and (
        (
          p_unit_key is not null
          and question.unit_key = p_unit_key
        )
        or (
          p_unit_key is null
          and p_book_code is not null
          and question.book_code = upper(p_book_code)
          and question.inferred_chapter
            between p_start_chapter and p_end_chapter
        )
      )
  ),
  ranked as (
    select *
    from candidate_base
    order by
      answered_in_attempt,
      answered_before,
      (
        coalesce(routing_score, 50)::numeric / 100.0
        + random() * 0.35
      ) desc,
      created_at desc
    limit 1
  )
  select
    generated_question_id,
    coalesce(payload->>'prompt', prompt),
    question_type,
    payload->'choices',
    target_label,
    book_code,
    case
      when coalesce(routing_score, 0) >= 80 then 1
      when coalesce(routing_score, 0) >= 60 then 2
      else 3
    end,
    target_section
  from ranked;
$$;

create or replace function public.obs_start_or_resume_ot_assessment_v2(
  p_unit_key text default null,
  p_book_code text default null,
  p_start_chapter integer default null,
  p_end_chapter integer default null,
  p_target_question_count integer default 20,
  p_force_new boolean default false,
  p_dimension_key text default null
)
returns table (
  attempt_id uuid,
  user_id uuid,
  assessment_kind text,
  scope_key text,
  unit_key text,
  label text,
  book_code text,
  start_chapter integer,
  end_chapter integer,
  target_question_count integer,
  available_question_count integer,
  answered_count integer,
  correct_count integer,
  idk_count integer,
  target_reached boolean,
  resumed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_dimension_key text :=
    public.obs_normalize_dimension_key(p_dimension_key);
  v_dimension public.obs_bli_dimensions%rowtype;
  v_unit public.obs_learning_units%rowtype;
  v_attempt_id uuid;
  v_target integer;
  v_available integer;
  v_answered integer := 0;
  v_correct integer := 0;
  v_idk integer := 0;
  v_resumed boolean := false;
  v_label text;
begin
  if p_dimension_key is null then
    return query
    select *
    from public.obs_start_or_resume_ot_assessment(
      p_unit_key,
      p_book_code,
      p_start_chapter,
      p_end_chapter,
      p_target_question_count,
      p_force_new
    );
    return;
  end if;

  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'An authenticated or anonymous Supabase session is required';
  end if;

  if v_dimension_key is null then
    raise exception using
      errcode = '22023',
      message = 'Focused retest dimension is not recognized';
  end if;

  select dimension.*
  into v_dimension
  from public.obs_bli_dimensions dimension
  where dimension.dimension_key = v_dimension_key
    and not dimension.is_advanced;

  if v_dimension.dimension_key is null then
    raise exception using
      errcode = '22023',
      message = 'This dimension is not available for a focused retest';
  end if;

  select unit.*
  into v_unit
  from public.obs_learning_units unit
  where (
    p_unit_key is not null
    and unit.unit_key = p_unit_key
  )
  or (
    p_unit_key is null
    and unit.book_code = upper(btrim(p_book_code))
    and unit.start_chapter = p_start_chapter
    and unit.end_chapter = p_end_chapter
  )
  order by unit.sequence_order
  limit 1;

  if v_unit.unit_key is null then
    raise exception using
      errcode = '22023',
      message = 'Focused retests must use a recognized learning unit';
  end if;

  select count(distinct coalesce(
    nullif(question.payload->>'stem_family', ''),
    question.generated_question_id::text
  ))::integer
  into v_available
  from public.obs_question_bank_with_units question
  where question.unit_key = v_unit.unit_key
    and question.dimension_key = v_dimension_key
    and question.generated_question_id is not null
    and question.payload ? 'choices'
    and jsonb_typeof(question.payload->'choices') = 'array'
    and jsonb_array_length(question.payload->'choices') >= 2;

  if coalesce(v_available, 0) < 3 then
    raise exception using
      errcode = 'P0002',
      message = 'Not enough varied questions are available for this dimension retest';
  end if;

  v_target := least(
    greatest(1, least(coalesce(p_target_question_count, 15), 50)),
    v_available
  );
  v_label := v_dimension.short_label || ' in ' || v_unit.label;

  if not coalesce(p_force_new, false) then
    select attempt.id
    into v_attempt_id
    from public.assessment_attempts attempt
    join public.obs_ot_attempt_context context
      on context.attempt_id = attempt.id
     and context.user_id = attempt.user_id
    where attempt.user_id = v_user_id
      and upper(coalesce(attempt.testament, 'OT')) = 'OT'
      and attempt.assessment_kind = 'ot_focused'
      and context.unit_key = v_unit.unit_key
      and context.dimension_key = v_dimension_key
      and attempt.completed_at is null
      and not coalesce(attempt.is_complete, false)
      and (
        select count(*)
        from public.assessment_answers answer
        where answer.attempt_id = attempt.id
          and answer.user_id = v_user_id
      ) < greatest(
        1,
        coalesce(
          attempt.target_question_count,
          attempt.question_target,
          v_target
        )
      )
    order by attempt.created_at desc
    limit 1;
  end if;

  if v_attempt_id is not null then
    v_resumed := true;

    select
      count(*)::integer,
      count(*) filter (where answer.is_correct)::integer,
      count(*) filter (where coalesce(answer.is_idk, false))::integer
    into v_answered, v_correct, v_idk
    from public.assessment_answers answer
    where answer.attempt_id = v_attempt_id
      and answer.user_id = v_user_id;

    select greatest(
      1,
      coalesce(
        attempt.target_question_count,
        attempt.question_target,
        v_target
      )
    )
    into v_target
    from public.assessment_attempts attempt
    where attempt.id = v_attempt_id;
  else
    insert into public.assessment_attempts (
      user_id,
      prior_self_rating,
      testament,
      scope_key,
      assessment_mode,
      assessment_kind,
      question_target,
      target_question_count,
      total_count,
      answered_count,
      correct_count,
      is_complete
    ) values (
      v_user_id,
      3,
      'OT',
      v_unit.book_code,
      'adaptive',
      'ot_focused',
      v_target,
      v_target,
      v_target,
      0,
      0,
      false
    )
    returning id into v_attempt_id;

    insert into public.obs_ot_attempt_context (
      attempt_id,
      user_id,
      unit_key,
      book_code,
      start_chapter,
      end_chapter,
      label,
      dimension_key
    ) values (
      v_attempt_id,
      v_user_id,
      v_unit.unit_key,
      v_unit.book_code,
      v_unit.start_chapter,
      v_unit.end_chapter,
      v_label,
      v_dimension_key
    );

    insert into public.obs_study_plan_events (
      user_id,
      unit_key,
      event_type,
      attempt_id,
      metadata
    ) values (
      v_user_id,
      v_unit.unit_key,
      'retest_started',
      v_attempt_id,
      jsonb_build_object(
        'source',
        'dimension_focused_assessment_start',
        'dimension_key',
        v_dimension_key
      )
    );
  end if;

  return query
  select
    v_attempt_id,
    v_user_id,
    'ot_focused'::text,
    v_unit.book_code,
    v_unit.unit_key,
    v_label,
    v_unit.book_code,
    v_unit.start_chapter,
    v_unit.end_chapter,
    v_target,
    v_available,
    v_answered,
    v_correct,
    v_idk,
    v_answered >= v_target,
    v_resumed;
end
$$;

create or replace function public.obs_get_next_ot_assessment_question(
  p_attempt_id uuid
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  event_title text,
  book_code text,
  importance_tier integer,
  section text
)
language sql
security definer
set search_path = public
as $$
  with authorized_attempt as (
    select
      attempt.id,
      attempt.user_id,
      attempt.assessment_kind,
      context.unit_key,
      context.book_code,
      context.start_chapter,
      context.end_chapter,
      context.dimension_key
    from public.assessment_attempts attempt
    left join public.obs_ot_attempt_context context
      on context.attempt_id = attempt.id
     and context.user_id = attempt.user_id
    where attempt.id = p_attempt_id
      and attempt.user_id = auth.uid()
      and upper(coalesce(attempt.testament, 'OT')) = 'OT'
      and attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
      and not coalesce(attempt.is_complete, false)
      and attempt.completed_at is null
  )
  select focused.*
  from authorized_attempt attempt
  cross join lateral public.obs_get_next_focused_question_v2(
    attempt.user_id,
    attempt.id,
    attempt.unit_key,
    attempt.book_code,
    attempt.start_chapter,
    attempt.end_chapter,
    attempt.dimension_key
  ) focused
  where attempt.assessment_kind = 'ot_focused'

  union all

  select adaptive.*
  from authorized_attempt attempt
  cross join lateral public.get_next_assessment_question(
    attempt.id,
    attempt.user_id
  ) adaptive
  where attempt.assessment_kind = 'ot_adaptive'
  limit 1;
$$;

revoke all on function public.obs_get_user_recommendation_v2(uuid)
  from public, anon;
revoke all on function public.obs_get_next_focused_question_v2(
  uuid, uuid, text, text, integer, integer, text
) from public, anon;
revoke all on function public.obs_start_or_resume_ot_assessment_v2(
  text, text, integer, integer, integer, boolean, text
) from public, anon;
revoke all on function public.obs_get_next_ot_assessment_question(uuid)
  from public, anon;

grant execute on function public.obs_get_user_recommendation_v2(uuid)
  to authenticated, service_role;
grant execute on function public.obs_get_next_focused_question_v2(
  uuid, uuid, text, text, integer, integer, text
) to authenticated, service_role;
grant execute on function public.obs_start_or_resume_ot_assessment_v2(
  text, text, integer, integer, integer, boolean, text
) to authenticated, service_role;
grant execute on function public.obs_get_next_ot_assessment_question(uuid)
  to authenticated, service_role;

comment on function public.obs_get_user_recommendation_v2(uuid) is
  'Pyramid-aware OT recommendation with an evidence and coverage gated dimension target.';
comment on function public.obs_start_or_resume_ot_assessment_v2(
  text, text, integer, integer, integer, boolean, text
) is
  'Starts or resumes a persistent OT assessment, optionally restricted to one dimension.';

notify pgrst, 'reload schema';

commit;
