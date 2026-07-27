-- Start or resume adaptive OT assessments for any canonical section or book.
-- Existing recommendation-focused learning-unit retests remain unchanged.

begin;

do $$
begin
  if to_regclass('public.assessment_attempts') is null
     or to_regclass('public.obs_biblical_books') is null
     or to_regclass('public.v_question_bank') is null
     or to_regprocedure(
       'public.obs_get_next_ot_assessment_question(uuid)'
     ) is null
     or to_regprocedure(
       'public.question_matches_assessment_scope(text,text,text)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Dashboard scope-assessment preflight failed; required contracts are missing.';
  end if;
end
$$;

create or replace function public.obs_start_or_resume_ot_scope_assessment(
  p_scope_key text,
  p_label text default null,
  p_target_question_count integer default 15,
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
  v_scope_key text := upper(btrim(coalesce(p_scope_key, '')));
  v_scope_label text;
  v_book_code text;
  v_available integer;
  v_target integer;
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

  if v_scope_key not in ('TORAH', 'FORMER', 'LATTER', 'WRITINGS')
     and not exists (
       select 1
       from public.obs_biblical_books book
       where book.book_code = v_scope_key
         and book.testament = 'OT'
     )
  then
    raise exception using
      errcode = '22023',
      message = 'OT scope test must use a canonical section or Old Testament book code';
  end if;

  if exists (
    select 1
    from public.obs_biblical_books book
    where book.book_code = v_scope_key
      and book.testament = 'OT'
  ) then
    v_book_code := v_scope_key;
  end if;

  select coalesce(
    nullif(btrim(p_label), ''),
    (
      select book.display_name
      from public.obs_biblical_books book
      where book.book_code = v_scope_key
    ),
    case v_scope_key
      when 'TORAH' then 'Torah'
      when 'FORMER' then 'Former Prophets'
      when 'LATTER' then 'Latter Prophets'
      when 'WRITINGS' then 'Writings'
    end
  )
  into v_scope_label;

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
    and public.question_matches_assessment_scope(
      question.book_code,
      'OT',
      v_scope_key
    );

  if coalesce(v_available, 0) = 0 then
    raise exception using
      errcode = 'P0002',
      message = 'No active questions are available for this Old Testament scope';
  end if;

  v_target := least(
    greatest(1, least(coalesce(p_target_question_count, 15), 50)),
    v_available
  );

  if not coalesce(p_force_new, false) then
    select attempt.id
    into v_attempt_id
    from public.assessment_attempts attempt
    where attempt.user_id = v_user_id
      and upper(coalesce(attempt.testament, 'OT')) = 'OT'
      and attempt.assessment_kind = 'ot_adaptive'
      and upper(coalesce(attempt.scope_key, '')) = v_scope_key
      and not exists (
        select 1
        from public.obs_ot_attempt_context context
        where context.attempt_id = attempt.id
      )
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
      v_scope_key,
      'adaptive',
      'ot_adaptive',
      v_target,
      v_target,
      v_target,
      0,
      0,
      false
    )
    returning id into v_attempt_id;
  end if;

  return query
  select
    v_attempt_id,
    v_user_id,
    'ot_adaptive'::text,
    v_scope_key,
    null::text,
    v_scope_label,
    v_book_code,
    null::integer,
    null::integer,
    v_target,
    v_available,
    v_answered,
    v_correct,
    v_idk,
    v_answered >= v_target,
    v_resumed;
end
$$;

revoke all on function public.obs_start_or_resume_ot_scope_assessment(
  text, text, integer, boolean
) from public, anon;

grant execute on function public.obs_start_or_resume_ot_scope_assessment(
  text, text, integer, boolean
) to authenticated, service_role;

comment on function public.obs_start_or_resume_ot_scope_assessment(
  text, text, integer, boolean
) is
  'Starts or resumes a main adaptive OT assessment scoped to one canonical section or book.';

notify pgrst, 'reload schema';

commit;
