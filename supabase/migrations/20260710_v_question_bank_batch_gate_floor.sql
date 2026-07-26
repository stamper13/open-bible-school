-- Fix batch-generated questions whose source payload importance was raised above
-- the router gate but whose router-facing view importance remains below 55.
--
-- This migration is intentionally reversible. It stores the pre-change
-- v_question_bank definition before replacing the view with a narrow wrapper.

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
  if exists (
    select 1
    from public.obs_schema_backups
    where backup_tag = '20260710_v_question_bank_batch_gate_floor'
      and object_schema = 'public'
      and object_name = 'v_question_bank'
  ) then
    raise notice '20260710_v_question_bank_batch_gate_floor already applied; skipping.';
    return;
  end if;

  select pg_get_viewdef('public.v_question_bank'::regclass, true)
  into old_definition;

  -- pg_get_viewdef may return a trailing semicolon. That is valid as a
  -- standalone view definition, but invalid when embedded inside a CTE.
  old_definition := regexp_replace(old_definition, ';[[:space:]]*$', '');

  insert into public.obs_schema_backups (
    backup_tag,
    object_schema,
    object_name,
    object_type,
    definition
  )
  values (
    '20260710_v_question_bank_batch_gate_floor',
    'public',
    'v_question_bank',
    'view',
    old_definition
  );

  execute format($view$
    create or replace view public.v_question_bank as
    with base as (
      %s
    ),
    scored as (
      select
        base.*,
        coalesce(
          case
            when (base.payload ->> 'importance_conceptual') ~ '^-?[0-9]+(\.[0-9]+)?$'
              then (base.payload ->> 'importance_conceptual')::numeric
          end,
          0
        ) as source_importance_conceptual
      from base
    )
    select
      generated_question_id,
      question_id,
      event_id,
      question_type,
      dedupe_key,
      prompt,
      payload,
      created_at,
      case
        when dedupe_key like 'batch%%'
          and coalesce(importance_conceptual, 0) < 55
          and source_importance_conceptual >= 55
          then 56::numeric
        else importance_conceptual
      end as importance_conceptual,
      importance_context,
      difficulty_estimate,
      book_code,
      case
        when dedupe_key like 'batch%%'
          and coalesce(importance_conceptual, 0) < 55
          and source_importance_conceptual >= 55
          then greatest(coalesce(routing_score, 56::numeric), 56::numeric)
        else routing_score
      end as routing_score
    from scored
  $view$, old_definition);
end $$;

grant select on public.v_question_bank to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
