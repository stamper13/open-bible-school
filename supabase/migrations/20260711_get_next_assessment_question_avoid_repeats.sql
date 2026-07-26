-- Make reassessments prefer genuinely new questions.
--
-- The previous general assessor selector could start each new assessment attempt
-- with the same high-priority questions because the frontend creates a fresh
-- assessment_attempts row every run. This replacement excludes questions already
-- answered in the current attempt, strongly prefers questions the user has never
-- answered before, and only falls back to least-seen / oldest-seen questions
-- after the fresh pool is exhausted.

begin;

create table if not exists public.obs_schema_backups (
  id uuid primary key default gen_random_uuid(),
  backup_tag text not null,
  object_schema text not null,
  object_name text not null,
  object_type text not null,
  definition text not null,
  created_at timestamptz not null default now()
);

do $$
declare
  old_definition text;
begin
  if not exists (
    select 1
    from public.obs_schema_backups
    where backup_tag = '20260711_get_next_assessment_question_avoid_repeats'
      and object_schema = 'public'
      and object_name = 'get_next_assessment_question'
  ) then
    select pg_get_functiondef(p.oid)
    into old_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_next_assessment_question'
      and p.proargtypes::text = '2950 2950'
    limit 1;

    if old_definition is not null then
      insert into public.obs_schema_backups (
        backup_tag,
        object_schema,
        object_name,
        object_type,
        definition
      )
      values (
        '20260711_get_next_assessment_question_avoid_repeats',
        'public',
        'get_next_assessment_question',
        'function',
        old_definition
      );
    end if;
  end if;
end $$;

drop function if exists public.get_next_assessment_question(uuid, uuid);

create function public.get_next_assessment_question(
  p_attempt_id uuid,
  p_user_id uuid
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
  user_history as (
    select
      a.generated_question_id,
      count(*)::integer as times_answered,
      max(a.answered_at) as last_answered_at
    from public.assessment_answers a
    join authorized on true
    where a.user_id = p_user_id
      and a.generated_question_id is not null
    group by a.generated_question_id
  ),
  candidate_base as (
    select
      q.generated_question_id,
      q.question_id,
      q.event_id,
      q.question_type,
      q.dedupe_key,
      coalesce(q.payload->>'prompt', q.prompt) as prompt,
      q.payload,
      q.created_at,
      q.importance_conceptual,
      q.importance_context,
      q.difficulty_estimate,
      q.book_code,
      q.routing_score,
      coalesce(bev.event_title, q.book_code || ' question') as event_title,
      coalesce(h.times_answered, 0) as times_answered,
      h.last_answered_at
    from public.v_question_bank q
    join authorized on true
    left join public.bible_events bev on bev.id = q.event_id
    left join user_history h on h.generated_question_id = q.generated_question_id
    where q.generated_question_id is not null
      and q.payload ? 'choices'
      and jsonb_typeof(q.payload->'choices') = 'array'
      and coalesce(q.importance_conceptual, 0) >= 55
      and not exists (
        select 1
        from public.assessment_answers a
        where a.user_id = p_user_id
          and a.attempt_id = p_attempt_id
          and a.generated_question_id = q.generated_question_id
      )
  ),
  ranked as (
    select *
    from candidate_base
    order by
      times_answered asc,
      last_answered_at asc nulls first,
      (coalesce(routing_score, importance_conceptual, importance_context, 50)::numeric / 100.0 + random() * 0.45) desc,
      created_at desc
    limit 1
  )
  select
    generated_question_id as out_generated_question_id,
    prompt,
    question_type,
    payload->'choices' as choices,
    event_title,
    book_code,
    case
      when coalesce(routing_score, 0) >= 80 then 1
      when coalesce(routing_score, 0) >= 60 then 2
      else 3
    end as importance_tier,
    case
      when book_code in ('GEN', 'EXO', 'LEV', 'NUM', 'DEU') then 'Torah'
      when book_code in ('JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI') then 'Former Prophets'
      when book_code in ('ISA', 'JER', 'LAM', 'EZE', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL') then 'Latter Prophets'
      when book_code in ('1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG') then 'Writings'
      else 'Old Testament'
    end as section
  from ranked;
$$;

revoke all on function public.get_next_assessment_question(uuid, uuid) from public, anon;
grant execute on function public.get_next_assessment_question(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
