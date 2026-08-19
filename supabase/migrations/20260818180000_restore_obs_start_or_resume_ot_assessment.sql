-- Restores public.obs_start_or_resume_ot_assessment(text, text, integer,
-- integer, integer, boolean), the 6-arg function that
-- obs_start_or_resume_ot_assessment_v2 delegates to whenever
-- p_dimension_key is null (i.e. every ordinary, non-focused-retest OT
-- assessment start/resume call -- the normal path most users take).
--
-- This function was dropped from production on 2026-08-18 during a
-- "verified cleanup pass" (see web/SCHEMA.md) that removed functions with
-- no direct .rpc() caller in the app repo. That check missed this one
-- because nothing calls it by name from the frontend -- it's only ever
-- reached indirectly, via _v2's internal delegation. This is exactly the
-- indirect-call trap SCHEMA.md's own "Versioning" section warns about.
--
-- Net effect since the drop: every call to obs_start_or_resume_ot_assessment_v2
-- with p_dimension_key = null raised "function
-- public.obs_start_or_resume_ot_assessment(...) does not exist" --
-- breaking the ordinary OT assessment start/resume flow in production.
-- Confirmed live via direct query against pg_proc before writing this fix.
--
-- This restores the function body verbatim from its last definition
-- (supabase/migrations/20260726_ot_persistent_focused_retests.sql), after
-- confirming every table/column/function it references is still present
-- and unchanged in the live schema. No logic changes.

create or replace function public.obs_start_or_resume_ot_assessment(
  p_unit_key text default null,
  p_book_code text default null,
  p_start_chapter integer default null,
  p_end_chapter integer default null,
  p_target_question_count integer default 20,
  p_force_new boolean default false
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
  v_unit public.obs_learning_units%rowtype;
  v_is_focused boolean;
  v_kind text;
  v_scope_key text;
  v_target integer;
  v_available integer;
  v_attempt_id uuid;
  v_answered integer := 0;
  v_correct integer := 0;
  v_idk integer := 0;
  v_resumed boolean := false;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'An authenticated or anonymous Supabase session is required';
  end if;

  v_is_focused := p_unit_key is not null
    or p_book_code is not null
    or p_start_chapter is not null
    or p_end_chapter is not null;

  if v_is_focused then
    select unit.*
    into v_unit
    from public.obs_learning_units unit
    where (p_unit_key is not null and unit.unit_key = p_unit_key)
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

    v_kind := 'ot_focused';
    v_scope_key := v_unit.book_code;

    select count(distinct coalesce(
      nullif(question.payload->>'stem_family', ''),
      question.generated_question_id::text
    ))::integer
    into v_available
    from public.obs_question_bank_with_units question
    where question.unit_key = v_unit.unit_key
      and question.generated_question_id is not null
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and jsonb_array_length(question.payload->'choices') >= 2;
  else
    v_kind := 'ot_adaptive';
    v_scope_key := 'OT';

    select count(distinct coalesce(
      nullif(question.payload->>'stem_family', ''),
      question.generated_question_id::text
    ))::integer
    into v_available
    from public.v_question_bank question
    where question.generated_question_id is not null
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and jsonb_array_length(question.payload->'choices') >= 2
      and public.obs_book_testament(question.book_code) = 'OT';
  end if;

  if coalesce(v_available, 0) = 0 then
    raise exception using
      errcode = 'P0002',
      message = 'No active questions are available for this Old Testament scope';
  end if;

  v_target := least(
    greatest(1, least(coalesce(p_target_question_count, 20), 50)),
    v_available
  );

  if not coalesce(p_force_new, false) then
    if v_is_focused then
      select attempt.id
      into v_attempt_id
      from public.assessment_attempts attempt
      join public.obs_ot_attempt_context context
        on context.attempt_id = attempt.id
       and context.user_id = attempt.user_id
      where attempt.user_id = v_user_id
        and upper(coalesce(attempt.testament, 'OT')) = 'OT'
        and attempt.assessment_kind = v_kind
        and context.unit_key = v_unit.unit_key
        and attempt.completed_at is null
        and not coalesce(attempt.is_complete, false)
        and (
          select count(*)
          from public.assessment_answers answer
          where answer.attempt_id = attempt.id
            and answer.user_id = v_user_id
        ) < greatest(1, coalesce(attempt.target_question_count, attempt.question_target, v_target))
      order by attempt.created_at desc
      limit 1;
    else
      select attempt.id
      into v_attempt_id
      from public.assessment_attempts attempt
      where attempt.user_id = v_user_id
        and upper(coalesce(attempt.testament, 'OT')) = 'OT'
        and attempt.assessment_kind = v_kind
        and upper(coalesce(attempt.scope_key, 'OT')) = 'OT'
        and attempt.completed_at is null
        and not coalesce(attempt.is_complete, false)
        and not exists (
          select 1
          from public.obs_ot_attempt_context context
          where context.attempt_id = attempt.id
        )
        and (
          select count(*)
          from public.assessment_answers answer
          where answer.attempt_id = attempt.id
            and answer.user_id = v_user_id
        ) < greatest(1, coalesce(attempt.target_question_count, attempt.question_target, v_target))
      order by attempt.created_at desc
      limit 1;
    end if;
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
      coalesce(attempt.target_question_count, attempt.question_target, v_target)
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
      v_scope_key,
      'adaptive',
      v_kind,
      v_target,
      v_target,
      v_target,
      0,
      0,
      false
    )
    returning id into v_attempt_id;

    if v_is_focused then
      insert into public.obs_ot_attempt_context (
        attempt_id,
        user_id,
        unit_key,
        book_code,
        start_chapter,
        end_chapter,
        label
      ) values (
        v_attempt_id,
        v_user_id,
        v_unit.unit_key,
        v_unit.book_code,
        v_unit.start_chapter,
        v_unit.end_chapter,
        v_unit.label
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
        jsonb_build_object('source', 'focused_assessment_start')
      );
    end if;
  end if;

  return query
  select
    v_attempt_id,
    v_user_id,
    v_kind,
    v_scope_key,
    case when v_is_focused then v_unit.unit_key else null end,
    case when v_is_focused then v_unit.label else 'Old Testament Assessment' end,
    case when v_is_focused then v_unit.book_code else null end,
    case when v_is_focused then v_unit.start_chapter else null end,
    case when v_is_focused then v_unit.end_chapter else null end,
    v_target,
    v_available,
    v_answered,
    v_correct,
    v_idk,
    v_answered >= v_target,
    v_resumed;
end;
$$;

revoke all on function public.obs_start_or_resume_ot_assessment(
  text, text, integer, integer, integer, boolean
) from public, anon;

grant execute on function public.obs_start_or_resume_ot_assessment(
  text, text, integer, integer, integer, boolean
) to authenticated, service_role;

comment on function public.obs_start_or_resume_ot_assessment(
  text, text, integer, integer, integer, boolean
) is
  'Starts or resumes a persistent adaptive or learning-unit-focused OT assessment. Restored 2026-08-18 after an over-eager dead-code cleanup dropped it despite obs_start_or_resume_ot_assessment_v2 still delegating to it internally for the non-focused-retest path.';
