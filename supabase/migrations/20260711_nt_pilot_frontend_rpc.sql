-- Safe frontend RPCs for the New Testament pilot.
--
-- These functions keep NT pilot answer keys out of the browser while allowing
-- the frontend to fetch pilot questions and grade one answer at a time.

begin;

create or replace function public.nt_get_pilot_questions(
  p_section text default null,
  p_book_code text default null,
  p_limit integer default 20
)
returns table (
  out_generated_question_id uuid,
  prompt text,
  question_type text,
  choices jsonb,
  book_code text,
  book_name text,
  nt_division text
)
language sql
security definer
set search_path = public
as $$
  select
    q.generated_question_id as out_generated_question_id,
    coalesce(q.payload->>'prompt', q.prompt) as prompt,
    q.question_type,
    q.payload->'choices' as choices,
    q.book_code,
    b.name as book_name,
    b.nt_division
  from public.v_nt_question_bank q
  left join public.scripture_books b
    on b.book_code = q.book_code
  where q.generated_question_id is not null
    and q.payload ? 'choices'
    and jsonb_typeof(q.payload->'choices') = 'array'
    and (p_book_code is null or q.book_code = upper(p_book_code))
    and (p_section is null or b.nt_division = p_section)
  order by random()
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

create or replace function public.nt_submit_pilot_answer(
  p_generated_question_id uuid,
  p_selected_choice_id text
)
returns table (
  is_correct boolean,
  correct_choice_id text
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(q.payload->>'correct_choice_id', q.payload->>'answer_id', q.payload->>'correctAnswerId') = p_selected_choice_id as is_correct,
    coalesce(q.payload->>'correct_choice_id', q.payload->>'answer_id', q.payload->>'correctAnswerId') as correct_choice_id
  from public.v_nt_question_bank q
  where q.generated_question_id = p_generated_question_id
  limit 1;
$$;

revoke all on function public.nt_get_pilot_questions(text, text, integer) from public;
revoke all on function public.nt_submit_pilot_answer(uuid, text) from public;
grant execute on function public.nt_get_pilot_questions(text, text, integer) to anon, authenticated;
grant execute on function public.nt_submit_pilot_answer(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
