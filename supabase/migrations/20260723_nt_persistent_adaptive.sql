-- Persistent one-question-at-a-time New Testament assessment backend.
--
-- This is additive. The legacy nt_get_pilot_questions and
-- nt_submit_pilot_answer RPCs remain available while the frontend migrates.
--
-- New flow:
--   1. obs_start_nt_assessment(...)
--   2. obs_get_next_nt_assessment_question(...)
--   3. obs_submit_nt_assessment_answer(...)
--   4. repeat steps 2-3 until target_reached

begin;

alter table public.assessment_attempts
  add column if not exists testament text;
alter table public.assessment_attempts
  add column if not exists scope_key text;
alter table public.assessment_attempts
  add column if not exists assessment_kind text;
alter table public.assessment_attempts
  add column if not exists target_question_count integer;
alter table public.assessment_attempts
  add column if not exists completed_at timestamptz;

update public.assessment_attempts
set testament = 'OT'
where testament is null;

update public.assessment_attempts
set scope_key = testament
where scope_key is null;

create index if not exists assessment_attempts_user_testament_idx
  on public.assessment_attempts (user_id, testament);

create or replace function public.obs_nt_scope_key(
  p_section text,
  p_book_code text default null
)
returns text
language sql
stable
parallel safe
set search_path = public
as $$
  select case
    when p_book_code is not null then upper(btrim(p_book_code))
    when upper(regexp_replace(coalesce(p_section, ''), '[^A-Za-z0-9]+', '_', 'g'))
      in ('GOSPELS_ACTS', 'GOSPELS_AND_ACTS') then 'GOSPELS_ACTS'
    when upper(regexp_replace(coalesce(p_section, ''), '[^A-Za-z0-9]+', '_', 'g'))
      in ('PAULINE', 'PAULINE_EPISTLES') then 'PAULINE'
    when upper(regexp_replace(coalesce(p_section, ''), '[^A-Za-z0-9]+', '_', 'g'))
      in ('GENERAL', 'GENERAL_EPISTLES') then 'GENERAL'
    when upper(regexp_replace(coalesce(p_section, ''), '[^A-Za-z0-9]+', '_', 'g'))
      = 'APOCALYPSE' then 'APOCALYPSE'
    else 'NT'
  end;
$$;

create or replace function public.obs_nt_question_matches_scope(
  p_book_code text,
  p_nt_division text,
  p_scope_key text
)
returns boolean
language sql
immutable
parallel safe
as $$
  select case upper(coalesce(p_scope_key, 'NT'))
    when 'NT' then true
    when 'GOSPELS_ACTS' then
      upper(regexp_replace(coalesce(p_nt_division, ''), '[^A-Za-z0-9]+', '_', 'g'))
        in ('GOSPELS_ACTS', 'GOSPELS_AND_ACTS')
    when 'PAULINE' then
      upper(regexp_replace(coalesce(p_nt_division, ''), '[^A-Za-z0-9]+', '_', 'g'))
        in ('PAULINE', 'PAULINE_EPISTLES')
    when 'GENERAL' then
      upper(regexp_replace(coalesce(p_nt_division, ''), '[^A-Za-z0-9]+', '_', 'g'))
        in ('GENERAL', 'GENERAL_EPISTLES')
    when 'APOCALYPSE' then
      upper(regexp_replace(coalesce(p_nt_division, ''), '[^A-Za-z0-9]+', '_', 'g'))
        = 'APOCALYPSE'
    else upper(coalesce(p_book_code, '')) = upper(p_scope_key)
  end;
$$;

create or replace function public.obs_start_nt_assessment(
  p_section text default null,
  p_book_code text default null,
  p_target_question_count integer default 20
)
returns table (
  attempt_id uuid,
  user_id uuid,
  testament text,
  scope_key text,
  target_question_count integer,
  available_question_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_scope_key text;
  v_target integer;
  v_available integer;
  v_attempt_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'An authenticated or anonymous Supabase session is required';
  end if;

  v_scope_key := public.obs_nt_scope_key(p_section, p_book_code);
  v_target := greatest(5, least(coalesce(p_target_question_count, 20), 50));

  if p_book_code is not null and not exists (
    select 1
    from public.scripture_books book
    where book.book_code = upper(p_book_code)
      and public.obs_book_testament(book.book_code) = 'NT'
  ) then
    raise exception using
      errcode = '22023',
      message = format('Unknown New Testament book code: %s', p_book_code);
  end if;

  select count(distinct coalesce(
    nullif(question.payload->>'stem_family', ''),
    question.generated_question_id::text
  ))::integer
  into v_available
  from public.v_nt_question_bank question
  left join public.scripture_books book
    on book.book_code = question.book_code
  where question.generated_question_id is not null
    and question.payload ? 'choices'
    and jsonb_typeof(question.payload->'choices') = 'array'
    and jsonb_array_length(question.payload->'choices') >= 2
    and public.obs_nt_question_matches_scope(
      question.book_code,
      book.nt_division,
      v_scope_key
    );

  if v_available = 0 then
    raise exception using
      errcode = 'P0002',
      message = 'No active questions are available for this New Testament scope';
  end if;

  v_target := least(v_target, v_available);

  insert into public.assessment_attempts (
    user_id,
    prior_self_rating,
    testament,
    scope_key,
    assessment_kind,
    target_question_count
  ) values (
    v_user_id,
    3,
    'NT',
    v_scope_key,
    'nt_adaptive',
    v_target
  )
  returning id into v_attempt_id;

  return query
  select
    v_attempt_id,
    v_user_id,
    'NT'::text,
    v_scope_key,
    v_target,
    v_available;
end;
$$;

create or replace function public.obs_get_next_nt_assessment_question(
  p_attempt_id uuid
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  book_code text,
  book_name text,
  nt_division text,
  answered_count integer,
  target_question_count integer
)
language sql
security definer
set search_path = public
as $$
  with authorized_attempt as (
    select
      attempt.id,
      attempt.user_id,
      upper(coalesce(attempt.scope_key, 'NT')) as scope_key,
      greatest(1, coalesce(attempt.target_question_count, 20)) as target_count
    from public.assessment_attempts attempt
    where attempt.id = p_attempt_id
      and attempt.user_id = auth.uid()
      and upper(coalesce(attempt.testament, 'NT')) = 'NT'
  ),
  attempt_answers as (
    select
      answer.generated_question_id,
      nullif(question.payload->>'stem_family', '') as stem_family
    from public.assessment_answers answer
    join public.v_nt_question_bank question
      on question.generated_question_id = answer.generated_question_id
    join authorized_attempt attempt
      on attempt.id = answer.attempt_id
  ),
  progress as (
    select count(*)::integer as answered
    from attempt_answers
  ),
  user_history as (
    select
      answer.generated_question_id,
      count(*)::integer as times_answered,
      max(answer.answered_at) as last_answered_at
    from public.assessment_answers answer
    join public.v_nt_question_bank question
      on question.generated_question_id = answer.generated_question_id
    where answer.user_id = auth.uid()
    group by answer.generated_question_id
  ),
  candidates as (
    select
      question.generated_question_id,
      coalesce(question.payload->>'prompt', question.prompt) as prompt,
      question.question_type,
      question.payload,
      question.book_code,
      book.name as book_name,
      book.nt_division,
      nullif(question.payload->>'stem_family', '') as stem_family,
      coalesce(history.times_answered, 0) as times_answered,
      history.last_answered_at,
      public.obs_effective_item_irt_a(question.payload, null) as effective_a,
      public.obs_effective_item_irt_b(question.payload, null) as effective_b,
      coalesce(
        ability.theta - 0.5 * coalesce(ability.theta_se, 1.0),
        nt_ability.theta - 0.5 * coalesce(nt_ability.theta_se, 1.0),
        0.0
      ) as theta_lcb,
      greatest(
        0.0,
        least(
          1.0,
          coalesce(
            public.obs_payload_number(
              question.payload,
              'importance_conceptual'
            ) / 100.0,
            0.60
          )
        )
      ) as importance_score,
      attempt.target_count
    from authorized_attempt attempt
    join public.v_nt_question_bank question
      on true
    left join public.scripture_books book
      on book.book_code = question.book_code
    left join public.user_abilities ability
      on ability.user_id = attempt.user_id
     and ability.scope = case
       when attempt.scope_key in (
         'GOSPELS_ACTS', 'PAULINE', 'GENERAL', 'APOCALYPSE'
       ) then attempt.scope_key
       else public.obs_nt_scope_key(book.nt_division, null)
     end
    left join public.user_abilities nt_ability
      on nt_ability.user_id = attempt.user_id
     and nt_ability.scope = 'NT'
    left join user_history history
      on history.generated_question_id = question.generated_question_id
    cross join progress
    where progress.answered < attempt.target_count
      and question.generated_question_id is not null
      and question.payload ? 'choices'
      and jsonb_typeof(question.payload->'choices') = 'array'
      and jsonb_array_length(question.payload->'choices') >= 2
      and public.obs_nt_question_matches_scope(
        question.book_code,
        book.nt_division,
        attempt.scope_key
      )
      and not exists (
        select 1
        from attempt_answers used
        where used.generated_question_id = question.generated_question_id
      )
      and not exists (
        select 1
        from attempt_answers used_family
        where nullif(question.payload->>'stem_family', '') is not null
          and used_family.stem_family = nullif(
            question.payload->>'stem_family',
            ''
          )
      )
  ),
  ranked as (
    select
      candidate.*,
      (
        0.55 * public.obs_item_information(
          candidate.theta_lcb,
          candidate.effective_a,
          candidate.effective_b
        )
        + 0.25 * candidate.importance_score
        + 0.15 * (1.0 / (1.0 + candidate.times_answered))
        + 0.05 * random()
      ) as adaptive_score
    from candidates candidate
  )
  select
    ranked.generated_question_id,
    ranked.prompt,
    ranked.question_type,
    ranked.payload->'choices',
    ranked.book_code,
    ranked.book_name,
    ranked.nt_division,
    progress.answered,
    ranked.target_count
  from ranked
  cross join progress
  order by
    ranked.adaptive_score desc,
    ranked.times_answered asc,
    ranked.last_answered_at asc nulls first,
    ranked.generated_question_id
  limit 1;
$$;

create or replace function public.obs_submit_nt_assessment_answer(
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
  remaining_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt record;
  v_question record;
  v_existing record;
  v_is_idk boolean;
  v_is_correct boolean;
  v_correct_choice_id text;
  v_answered integer;
  v_correct integer;
  v_division_scope text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select
    attempt.id,
    attempt.scope_key,
    greatest(1, coalesce(attempt.target_question_count, 20)) as target_count
  into v_attempt
  from public.assessment_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = v_user_id
    and upper(coalesce(attempt.testament, 'NT')) = 'NT'
  for update;

  if v_attempt.id is null then
    raise exception using errcode = '42501', message = 'Attempt not found or not authorized';
  end if;

  select
    question.generated_question_id,
    generated.event_id,
    question.payload,
    question.book_code,
    book.nt_division
  into v_question
  from public.v_nt_question_bank question
  join public.ot_generated_questions generated
    on generated.id = question.generated_question_id
  left join public.scripture_books book
    on book.book_code = question.book_code
  where question.generated_question_id = p_generated_question_id
    and public.obs_nt_question_matches_scope(
      question.book_code,
      book.nt_division,
      v_attempt.scope_key
    )
  limit 1;

  if v_question.generated_question_id is null then
    raise exception using
      errcode = '22023',
      message = 'Question is not active or does not belong to this assessment scope';
  end if;

  v_correct_choice_id := coalesce(
    v_question.payload->>'correct_choice_id',
    v_question.payload->>'answer_id',
    v_question.payload->>'correctAnswerId'
  );

  if v_correct_choice_id is null then
    raise exception using errcode = '22023', message = 'Question has no answer key';
  end if;

  v_is_idk := upper(coalesce(p_selected_choice_id, '')) = '__IDK__';

  if not v_is_idk and not exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(v_question.payload->'choices') = 'array'
          then v_question.payload->'choices'
        else '[]'::jsonb
      end
    ) choice
    where choice->>'id' = p_selected_choice_id
  ) then
    raise exception using errcode = '22023', message = 'Selected choice is invalid';
  end if;

  select answer.is_correct, coalesce(answer.is_idk, false)
  into v_existing
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id
    and answer.generated_question_id = p_generated_question_id
    and answer.user_id = v_user_id
  limit 1;

  if found then
    v_is_correct := v_existing.is_correct;
    v_is_idk := v_existing.is_idk;
  else
    v_is_correct := not v_is_idk
      and p_selected_choice_id = v_correct_choice_id;

    insert into public.assessment_answers (
      attempt_id,
      user_id,
      generated_question_id,
      selected_choice_id,
      is_correct,
      is_idk,
      answered_at
    ) values (
      p_attempt_id,
      v_user_id,
      p_generated_question_id,
      p_selected_choice_id,
      v_is_correct,
      v_is_idk,
      now()
    );

    v_division_scope := public.obs_nt_scope_key(
      v_question.nt_division,
      null
    );

    perform public.update_theta_internal(
      v_user_id,
      v_division_scope,
      v_question.event_id,
      v_is_correct
    );
    perform public.update_theta_internal(
      v_user_id,
      'NT',
      v_question.event_id,
      v_is_correct
    );
  end if;

  select
    count(*)::integer,
    count(*) filter (where answer.is_correct)::integer
  into v_answered, v_correct
  from public.assessment_answers answer
  where answer.attempt_id = p_attempt_id
    and answer.user_id = v_user_id;

  if v_answered >= v_attempt.target_count then
    update public.assessment_attempts
    set completed_at = coalesce(completed_at, now())
    where id = p_attempt_id;
  end if;

  return query
  select
    v_is_correct,
    v_is_idk,
    v_correct_choice_id,
    v_answered,
    v_correct,
    v_attempt.target_count,
    v_answered >= v_attempt.target_count,
    greatest(v_attempt.target_count - v_answered, 0);
end;
$$;

create or replace function public.obs_get_nt_assessment_status(
  p_attempt_id uuid
)
returns table (
  attempt_id uuid,
  scope_key text,
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
    attempt.scope_key,
    count(answer.id)::integer,
    count(answer.id) filter (where answer.is_correct)::integer,
    count(answer.id) filter (where coalesce(answer.is_idk, false))::integer,
    greatest(1, coalesce(attempt.target_question_count, 20)),
    count(answer.id) >= greatest(1, coalesce(attempt.target_question_count, 20)),
    attempt.completed_at
  from public.assessment_attempts attempt
  left join public.assessment_answers answer
    on answer.attempt_id = attempt.id
   and answer.user_id = attempt.user_id
  where attempt.id = p_attempt_id
    and attempt.user_id = auth.uid()
    and upper(coalesce(attempt.testament, 'NT')) = 'NT'
  group by
    attempt.id,
    attempt.scope_key,
    attempt.target_question_count,
    attempt.completed_at;
$$;

grant execute on function public.obs_nt_scope_key(text, text)
  to anon, authenticated, service_role;
grant execute on function public.obs_nt_question_matches_scope(text, text, text)
  to anon, authenticated, service_role;

revoke all on function public.obs_start_nt_assessment(text, text, integer)
  from public, anon;
revoke all on function public.obs_get_next_nt_assessment_question(uuid)
  from public, anon;
revoke all on function public.obs_submit_nt_assessment_answer(uuid, uuid, text)
  from public, anon;
revoke all on function public.obs_get_nt_assessment_status(uuid)
  from public, anon;

grant execute on function public.obs_start_nt_assessment(text, text, integer)
  to authenticated, service_role;
grant execute on function public.obs_get_next_nt_assessment_question(uuid)
  to authenticated, service_role;
grant execute on function public.obs_submit_nt_assessment_answer(uuid, uuid, text)
  to authenticated, service_role;
grant execute on function public.obs_get_nt_assessment_status(uuid)
  to authenticated, service_role;

comment on function public.obs_start_nt_assessment(text, text, integer) is
  'Starts a persistent NT assessment for a signed-in or Supabase anonymous-auth user.';

comment on function public.obs_get_next_nt_assessment_question(uuid) is
  'Returns one adaptive NT question without exposing its answer key.';

comment on function public.obs_submit_nt_assessment_answer(uuid, uuid, text) is
  'Grades and persists one NT answer, updates division and NT abilities, and reports completion progress.';

notify pgrst, 'reload schema';

commit;
