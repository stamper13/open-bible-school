-- Persistent Old Testament assessments and recommendation-focused retests.
--
-- This migration is additive. Legacy OT attempts remain untouched and are not
-- resumed. New focused attempts retain their canonical learning-unit context
-- server-side so a recommendation cannot silently degrade into a general test.

begin;

create table if not exists public.obs_ot_attempt_context (
  attempt_id uuid primary key
    references public.assessment_attempts(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  unit_key text
    references public.obs_learning_units(unit_key) on delete restrict,
  book_code text not null,
  start_chapter integer not null,
  end_chapter integer not null,
  label text not null,
  created_at timestamptz not null default now(),
  constraint obs_ot_attempt_context_chapter_ck
    check (start_chapter >= 1 and end_chapter >= start_chapter)
);

create index if not exists obs_ot_attempt_context_user_unit_idx
  on public.obs_ot_attempt_context (user_id, unit_key, created_at desc);

alter table public.obs_ot_attempt_context enable row level security;

drop policy if exists obs_ot_attempt_context_own_select
  on public.obs_ot_attempt_context;
create policy obs_ot_attempt_context_own_select
  on public.obs_ot_attempt_context
  for select
  using (auth.uid() = user_id);

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

create or replace function public.obs_get_ot_assessment_status(
  p_attempt_id uuid
)
returns table (
  attempt_id uuid,
  assessment_kind text,
  scope_key text,
  unit_key text,
  label text,
  book_code text,
  start_chapter integer,
  end_chapter integer,
  answered_count integer,
  correct_count integer,
  idk_count integer,
  target_question_count integer,
  target_reached boolean,
  completed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    attempt.id,
    attempt.assessment_kind,
    attempt.scope_key,
    context.unit_key,
    coalesce(context.label, 'Old Testament Assessment'),
    context.book_code,
    context.start_chapter,
    context.end_chapter,
    count(answer.id)::integer,
    count(answer.id) filter (where answer.is_correct)::integer,
    count(answer.id) filter (where coalesce(answer.is_idk, false))::integer,
    greatest(1, coalesce(attempt.target_question_count, attempt.question_target, 20)),
    count(answer.id) >= greatest(1, coalesce(attempt.target_question_count, attempt.question_target, 20)),
    attempt.completed_at
  from public.assessment_attempts attempt
  left join public.obs_ot_attempt_context context
    on context.attempt_id = attempt.id
   and context.user_id = attempt.user_id
  left join public.assessment_answers answer
    on answer.attempt_id = attempt.id
   and answer.user_id = attempt.user_id
  where attempt.id = p_attempt_id
    and attempt.user_id = auth.uid()
    and upper(coalesce(attempt.testament, 'OT')) = 'OT'
    and attempt.assessment_kind in ('ot_adaptive', 'ot_focused')
  group by
    attempt.id,
    attempt.assessment_kind,
    attempt.scope_key,
    attempt.target_question_count,
    attempt.question_target,
    attempt.completed_at,
    context.unit_key,
    context.label,
    context.book_code,
    context.start_chapter,
    context.end_chapter;
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
      context.end_chapter
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
  cross join lateral public.obs_get_next_focused_question(
    attempt.user_id,
    attempt.id,
    attempt.unit_key,
    attempt.book_code,
    attempt.start_chapter,
    attempt.end_chapter
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

create or replace function public.obs_submit_ot_assessment_answer(
  p_attempt_id uuid,
  p_generated_question_id uuid,
  p_selected_choice_id text
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
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt record;
  v_result record;
  v_answered integer;
  v_correct integer;
  v_target integer;
  v_reached boolean;
  v_is_idk boolean;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select
    attempt.id,
    attempt.assessment_kind,
    context.unit_key,
    greatest(1, coalesce(attempt.target_question_count, attempt.question_target, 20)) as target_count
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
    raise exception using errcode = '42501', message = 'Attempt not found or not authorized';
  end if;

  select *
  into v_result
  from public.submit_assessment_answer_v1(
    p_attempt_id,
    v_user_id,
    p_generated_question_id,
    p_selected_choice_id
  );

  if v_result.out_generated_question_id is null then
    raise exception using errcode = 'P0001', message = 'Answer submission returned no result';
  end if;

  select
    count(*)::integer,
    count(*) filter (where answer.is_correct)::integer
  into v_answered, v_correct
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id
    and answer.user_id = v_user_id;

  v_target := v_attempt.target_count;
  v_reached := v_answered >= v_target;
  v_is_idk := upper(coalesce(p_selected_choice_id, '')) = '__IDK__';

  update public.assessment_attempts
  set answered_count = v_answered,
      correct_count = v_correct,
      is_complete = v_reached,
      completed_at = case
        when v_reached then coalesce(completed_at, now())
        else completed_at
      end
  where id = p_attempt_id;

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
        'source', 'focused_assessment_completion',
        'answered_count', v_answered,
        'correct_count', v_correct
      )
    );
  end if;

  return query
  select
    coalesce(v_result.is_correct, false),
    v_is_idk,
    v_result.correct_choice_id,
    v_answered,
    v_correct,
    v_target,
    v_reached,
    greatest(v_target - v_answered, 0),
    v_attempt.assessment_kind,
    v_attempt.unit_key;
end;
$$;

revoke all on table public.obs_ot_attempt_context
  from public, anon, authenticated;
grant select on table public.obs_ot_attempt_context
  to authenticated, service_role;
grant all on table public.obs_ot_attempt_context
  to service_role;

revoke all on function public.obs_start_or_resume_ot_assessment(
  text, text, integer, integer, integer, boolean
) from public, anon;
revoke all on function public.obs_get_ot_assessment_status(uuid)
  from public, anon;
revoke all on function public.obs_get_next_ot_assessment_question(uuid)
  from public, anon;
revoke all on function public.obs_submit_ot_assessment_answer(uuid, uuid, text)
  from public, anon;

grant execute on function public.obs_start_or_resume_ot_assessment(
  text, text, integer, integer, integer, boolean
) to authenticated, service_role;
grant execute on function public.obs_get_ot_assessment_status(uuid)
  to authenticated, service_role;
grant execute on function public.obs_get_next_ot_assessment_question(uuid)
  to authenticated, service_role;
grant execute on function public.obs_submit_ot_assessment_answer(uuid, uuid, text)
  to authenticated, service_role;

comment on table public.obs_ot_attempt_context is
  'Canonical learning-unit context for persistent focused Old Testament retests.';
comment on function public.obs_start_or_resume_ot_assessment(
  text, text, integer, integer, integer, boolean
) is
  'Starts or resumes a persistent adaptive or learning-unit-focused OT assessment.';
comment on function public.obs_get_next_ot_assessment_question(uuid) is
  'Returns the next answer-free OT question for an authorized persistent attempt.';
comment on function public.obs_submit_ot_assessment_answer(uuid, uuid, text) is
  'Grades an OT answer, persists progress, and completes focused retest study events.';

notify pgrst, 'reload schema';

commit;
