begin;

drop function if exists public.obs_get_public_question_metadata(integer, integer);

create or replace view public.obs_public_question_metadata
with (security_barrier = true)
as
select
  q.generated_question_id,
  q.question_type,
  q.dimension_key,
  case
    when q.payload->>'question_layer' ~ '^[123]$'
      then (q.payload->>'question_layer')::integer
    else null
  end as question_layer,
  upper(q.book_code) as book_code,
  q.routing_score,
  q.importance_conceptual,
  q.importance_context
from public.obs_question_bank_with_dimensions q;

grant select on table public.obs_public_question_metadata
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
