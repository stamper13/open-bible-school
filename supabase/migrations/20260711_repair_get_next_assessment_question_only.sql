-- Emergency repair for get_next_assessment_question after failed replacement attempts.
-- This file intentionally has no backup block and no pg_get_functiondef call.

begin;

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

