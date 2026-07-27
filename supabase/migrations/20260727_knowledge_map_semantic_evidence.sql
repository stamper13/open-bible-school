-- Answer-free evidence feed for the semantic knowledge map.
--
-- This function exposes only the metadata needed to place a user's own
-- responses into book, learning-unit, chapter, and dimension nodes. It does
-- not expose prompts, choices, correct answers, payloads, or answer keys.

begin;

do $$
begin
  if to_regclass('public.assessment_answers') is null
     or to_regclass('public.obs_answer_evidence') is null
     or to_regclass('public.obs_learning_units') is null
     or to_regclass('public.obs_question_bank_with_dimensions') is null
     or to_regprocedure('public.obs_is_authorized_user(uuid)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Semantic knowledge-map evidence prerequisites are missing; nothing was installed.';
  end if;
end
$$;

create or replace function public.obs_get_user_knowledge_evidence(
  p_user_id uuid
)
returns table (
  generated_question_id uuid,
  book_code text,
  inferred_chapter integer,
  unit_key text,
  dimension_key text,
  is_correct boolean,
  is_idk boolean,
  scoring_eligible boolean,
  answered_at timestamptz,
  importance_weight numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    evidence.generated_question_id,
    evidence.book_code,
    evidence.inferred_chapter,
    unit.unit_key,
    evidence.dimension_key,
    evidence.is_correct,
    evidence.is_idk,
    answer.scoring_eligible,
    evidence.answered_at,
    greatest(
      1::numeric,
      coalesce(
        case
          when question.importance_conceptual is not null
            or question.importance_context is not null
          then
            0.70 * coalesce(question.importance_conceptual, 0)
            + 0.30 * coalesce(question.importance_context, 0)
          else null
        end,
        question.routing_score * 100,
        case evidence.importance_tier
          when 1 then 90
          when 2 then 60
          else 35
        end
      )::numeric
    ) as importance_weight
  from public.obs_answer_evidence evidence
  join public.assessment_answers answer
    on answer.id = evidence.answer_id
  left join public.obs_learning_units unit
    on unit.book_code = evidence.book_code
   and evidence.inferred_chapter between unit.start_chapter and unit.end_chapter
  left join public.obs_question_bank_with_dimensions question
    on question.generated_question_id = evidence.generated_question_id
  where evidence.user_id = p_user_id
    and public.obs_is_authorized_user(p_user_id)
  order by evidence.answered_at, evidence.generated_question_id;
$$;

revoke all on function public.obs_get_user_knowledge_evidence(uuid)
  from public, anon;
grant execute on function public.obs_get_user_knowledge_evidence(uuid)
  to authenticated, service_role;

comment on function public.obs_get_user_knowledge_evidence(uuid) is
  'Answer-free, owner-authorized response metadata for semantic knowledge-map evidence states.';

notify pgrst, 'reload schema';

commit;
