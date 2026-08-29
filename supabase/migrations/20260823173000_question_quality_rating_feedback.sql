create table if not exists public.obs_question_quality_ratings (
  id uuid primary key default gen_random_uuid(),
  generated_question_id uuid not null references public.ot_generated_questions(id) on delete cascade,
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null,
  feedback_text text,
  selected_choice_id text,
  correct_choice_id text,
  question_prompt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obs_question_quality_ratings_rating_ck check (rating between 1 and 3),
  constraint obs_question_quality_ratings_once_per_attempt_question_uk
    unique (user_id, attempt_id, generated_question_id)
);

alter table public.obs_question_quality_ratings enable row level security;

revoke all on table public.obs_question_quality_ratings from public, anon, authenticated;
grant all on table public.obs_question_quality_ratings to service_role;

drop policy if exists "quality ratings: own rows select" on public.obs_question_quality_ratings;
create policy "quality ratings: own rows select"
on public.obs_question_quality_ratings
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "quality ratings: own rows insert" on public.obs_question_quality_ratings;
create policy "quality ratings: own rows insert"
on public.obs_question_quality_ratings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "quality ratings: own rows update" on public.obs_question_quality_ratings;
create policy "quality ratings: own rows update"
on public.obs_question_quality_ratings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists obs_question_quality_ratings_question_idx
  on public.obs_question_quality_ratings (generated_question_id, created_at desc);

create index if not exists obs_question_quality_ratings_user_created_idx
  on public.obs_question_quality_ratings (user_id, created_at desc);

create or replace function public.obs_submit_question_quality_rating(
  p_attempt_id uuid,
  p_generated_question_id uuid,
  p_rating smallint,
  p_feedback_text text default null,
  p_selected_choice_id text default null,
  p_correct_choice_id text default null,
  p_question_prompt text default null
)
returns table (
  out_rating smallint,
  out_created_at timestamptz,
  out_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if p_attempt_id is null then
    raise exception 'attempt_id is required'
      using errcode = '22023';
  end if;

  if p_generated_question_id is null then
    raise exception 'generated_question_id is required'
      using errcode = '22023';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 3 then
    raise exception 'rating must be between 1 and 3'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.assessment_attempts attempt
    where attempt.id = p_attempt_id
      and attempt.user_id = v_user_id
  ) then
    raise exception 'Assessment attempt not found'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.ot_generated_questions question
    where question.id = p_generated_question_id
  ) then
    raise exception 'Question not found'
      using errcode = '22023';
  end if;

  return query
  insert into public.obs_question_quality_ratings (
    generated_question_id,
    attempt_id,
    user_id,
    rating,
    feedback_text,
    selected_choice_id,
    correct_choice_id,
    question_prompt
  )
  values (
    p_generated_question_id,
    p_attempt_id,
    v_user_id,
    p_rating,
    nullif(btrim(p_feedback_text), ''),
    nullif(btrim(p_selected_choice_id), ''),
    nullif(btrim(p_correct_choice_id), ''),
    nullif(btrim(p_question_prompt), '')
  )
  on conflict (user_id, attempt_id, generated_question_id)
  do update set
    rating = excluded.rating,
    feedback_text = excluded.feedback_text,
    selected_choice_id = excluded.selected_choice_id,
    correct_choice_id = excluded.correct_choice_id,
    question_prompt = excluded.question_prompt,
    updated_at = now()
  returning
    obs_question_quality_ratings.rating,
    obs_question_quality_ratings.created_at,
    obs_question_quality_ratings.updated_at;
end;
$$;

revoke execute on function public.obs_submit_question_quality_rating(
  uuid, uuid, smallint, text, text, text, text
) from public, anon;
grant execute on function public.obs_submit_question_quality_rating(
  uuid, uuid, smallint, text, text, text, text
) to authenticated;

comment on table public.obs_question_quality_ratings is
  'Learner question-quality ratings from the assessment feedback modal.';

comment on function public.obs_submit_question_quality_rating(
  uuid, uuid, smallint, text, text, text, text
) is
  'Authenticated assessment RPC for recording a 1-3 question-quality rating.';
