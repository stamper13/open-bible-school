-- Make the NT assessment bank cheaper for the live next-question router.
--
-- The previous view filtered NT rows with canonical_testament(book_code),
-- which repeatedly invoked taxonomy helper functions over the complex
-- v_question_bank view. Joining scripture_books lets Postgres use the
-- canonical book metadata directly while preserving the public view contract.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace view public.v_nt_question_bank as
select
  question.generated_question_id,
  question.question_id,
  question.event_id,
  question.question_type,
  question.dedupe_key,
  question.prompt,
  question.payload,
  question.created_at,
  question.importance_conceptual,
  question.importance_context,
  question.difficulty_estimate,
  question.book_code,
  question.routing_score,
  public.canonical_assessment_scope(question.book_code) as nt_scope
from public.v_question_bank question
join public.scripture_books book
  on book.book_code = question.book_code
where book.testament = 'NT';

notify pgrst, 'reload schema';

commit;
