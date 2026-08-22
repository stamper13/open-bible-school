begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace view public.v_nt_question_bank as
select
  generated_question_id,
  question_id,
  event_id,
  question_type,
  dedupe_key,
  prompt,
  payload,
  created_at,
  importance_conceptual,
  importance_context,
  difficulty_estimate,
  book_code,
  routing_score,
  public.canonical_assessment_scope(book_code) as nt_scope
from public.v_question_bank v
where public.canonical_testament(book_code) = 'NT';

notify pgrst, 'reload schema';

commit;
