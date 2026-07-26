-- Public question metadata and scoring-RPC hardening.
--
-- This migration:
--   * removes browser access to answer-bearing question tables and views;
--   * exposes a deliberately narrow metadata view for dashboard visualizations;
--   * wraps compute_bli with an ownership check without changing its scoring math;
--   * makes update_theta_internal callable only by trusted backend code; and
--   * retires the superseded NT pilot question/grading RPCs.

begin;

alter table public.ot_generated_questions enable row level security;

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

comment on view public.obs_public_question_metadata is
  'Answer-free question metadata for public dashboard and knowledge-map visualizations.';

revoke all on table public.ot_generated_questions
  from public, anon, authenticated;
revoke all on table public.v_question_bank
  from public, anon, authenticated;
revoke all on table public.obs_question_bank_with_dimensions
  from public, anon, authenticated;
revoke all on table public.obs_question_bank_with_units
  from public, anon, authenticated;

do $$
begin
  if to_regclass('public.v_nt_question_bank') is not null then
    execute
      'revoke all on table public.v_nt_question_bank from public, anon, authenticated';
  end if;
end
$$;

grant select on table public.ot_generated_questions to service_role;
grant select on table public.v_question_bank to service_role;
grant select on table public.obs_question_bank_with_dimensions to service_role;
grant select on table public.obs_question_bank_with_units to service_role;
grant select on table public.obs_public_question_metadata
  to anon, authenticated, service_role;

-- Preserve the exact live scoring implementation under a private name. The
-- public function below is only an authorization wrapper.
do $$
begin
  if to_regprocedure('public.obs_compute_bli_internal(uuid)') is null then
    if to_regprocedure('public.compute_bli(uuid)') is null then
      raise exception using
        errcode = 'P0001',
        message = 'compute_bli(uuid) is missing; refusing to install its authorization wrapper.';
    end if;

    alter function public.compute_bli(uuid)
      rename to obs_compute_bli_internal;
  end if;
end
$$;

revoke all on function public.obs_compute_bli_internal(uuid)
  from public, anon, authenticated;
grant execute on function public.obs_compute_bli_internal(uuid)
  to service_role;

create or replace function public.compute_bli(p_user_id uuid)
returns table(
  bli_score numeric,
  bli_level text,
  total_weighted_possible numeric,
  total_weighted_earned numeric,
  questions_answered integer,
  section_scores jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  then
    raise exception using
      errcode = '42501',
      message = 'Not authorized to read this BLI';
  end if;

  return query
  select *
  from public.obs_compute_bli_internal(p_user_id);
end;
$$;

comment on function public.compute_bli(uuid) is
  'Returns the caller''s BLI, or any user''s BLI to service_role. Scoring remains in obs_compute_bli_internal.';

revoke all on function public.compute_bli(uuid)
  from public, anon;
grant execute on function public.compute_bli(uuid)
  to authenticated, service_role;

revoke all on function public.update_theta_internal(uuid, text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.update_theta_internal(uuid, text, uuid, boolean)
  to service_role;

do $$
begin
  if to_regprocedure('public.nt_get_pilot_questions(text,text,integer)') is not null then
    execute
      'revoke all on function public.nt_get_pilot_questions(text,text,integer) from public, anon, authenticated';
  end if;

  if to_regprocedure('public.nt_submit_pilot_answer(uuid,text)') is not null then
    execute
      'revoke all on function public.nt_submit_pilot_answer(uuid,text) from public, anon, authenticated';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
