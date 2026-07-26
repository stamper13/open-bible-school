-- Replace the public metadata view with a paginated security-definer RPC.
--
-- The legacy question-bank view chain checks invoker privileges internally, so
-- granting the narrow outer view is insufficient after the raw views are
-- revoked. This RPC preserves the answer-free projection while executing the
-- protected source query as its owner.

begin;

drop view if exists public.obs_public_question_metadata;

create or replace function public.obs_get_public_question_metadata(
  p_offset integer default 0,
  p_limit integer default 1000
)
returns table (
  generated_question_id uuid,
  question_type text,
  dimension_key text,
  question_layer integer,
  book_code text,
  routing_score numeric,
  importance_conceptual numeric,
  importance_context numeric
)
language sql
stable
security definer
set search_path = public
as $$
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
  from public.obs_question_bank_with_dimensions q
  order by q.generated_question_id
  offset greatest(coalesce(p_offset, 0), 0)
  limit greatest(1, least(coalesce(p_limit, 1000), 1000));
$$;

comment on function public.obs_get_public_question_metadata(integer, integer) is
  'Paginated answer-free metadata for dashboard and knowledge-map visualizations.';

revoke all on function public.obs_get_public_question_metadata(integer, integer)
  from public;
grant execute on function public.obs_get_public_question_metadata(integer, integer)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
