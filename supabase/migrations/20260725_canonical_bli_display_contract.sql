-- Canonical zero-based BLI display contract.
--
-- Raw psychometric scoring remains on its existing 0-100 scale. Display scores
-- use raw * 8, producing these equivalent seven levels:
--   0-120   Unfamiliar
--   121-312 Acquainted
--   313-512 Familiar
--   513-632 Literate
--   633-712 Studied
--   713-760 Learned
--   761-800 Scholar
--
-- Existing progress snapshots are recalculated from their stored raw score.
-- The recommendation baseline moves from 585 to the equivalent score of 513.

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
  target record;
  v_definition text;
  v_backup_count integer;
begin
  for target in
    select *
    from (
      values
        ('compute_bli', 'uuid'),
        ('obs_display_score_from_raw', 'numeric'),
        ('obs_display_bli_level', 'integer')
    ) as functions(function_name, function_args)
  loop
    if to_regprocedure(
      'public.' || target.function_name || '(' || target.function_args || ')'
    ) is null then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Required function public.%s(%s) is missing; no changes made.',
          target.function_name,
          target.function_args
        );
    end if;

    if not exists (
      select 1
      from public.obs_schema_backups
      where backup_tag = '20260725_canonical_bli_display_contract'
        and object_schema = 'public'
        and object_name = target.function_name
        and object_type = 'function'
    ) then
      select pg_get_functiondef(
        to_regprocedure(
          'public.' || target.function_name || '(' || target.function_args || ')'
        )
      )
      into v_definition;

      insert into public.obs_schema_backups (
        backup_tag,
        object_schema,
        object_name,
        object_type,
        definition
      ) values (
        '20260725_canonical_bli_display_contract',
        'public',
        target.function_name,
        'function',
        v_definition
      );
    end if;
  end loop;

  select count(*)
  into v_backup_count
  from public.obs_schema_backups
  where backup_tag = '20260725_canonical_bli_display_contract'
    and object_schema = 'public'
    and object_name in (
      'compute_bli',
      'obs_display_score_from_raw',
      'obs_display_bli_level'
    )
    and object_type = 'function';

  if v_backup_count <> 3 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected exactly three canonical BLI backups, found %s; no changes made.',
        v_backup_count
      );
  end if;

  if to_regprocedure('public.obs_compute_bli_internal(uuid)') is null
     or to_regclass('public.obs_learning_units') is null
     or to_regclass('public.obs_assessment_snapshots') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Canonical BLI table or scorer prerequisites are missing; no changes made.';
  end if;
end
$$;

create or replace function public.obs_display_score_from_raw(p_raw_pct numeric)
returns integer
language sql
immutable
parallel safe
as $$
  select greatest(
    0,
    least(800, round(coalesce(p_raw_pct, 0) * 8)::integer)
  );
$$;

create or replace function public.obs_display_bli_level(p_display_bli integer)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when coalesce(p_display_bli, 0) <= 120 then 'Unfamiliar'
    when p_display_bli <= 312 then 'Acquainted'
    when p_display_bli <= 512 then 'Familiar'
    when p_display_bli <= 632 then 'Literate'
    when p_display_bli <= 712 then 'Studied'
    when p_display_bli <= 760 then 'Learned'
    else 'Scholar'
  end;
$$;

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
  select
    scored.bli_score,
    public.obs_display_bli_level(
      public.obs_display_score_from_raw(scored.bli_score)
    ),
    scored.total_weighted_possible,
    scored.total_weighted_earned,
    scored.questions_answered,
    scored.section_scores
  from public.obs_compute_bli_internal(p_user_id) scored;
end;
$$;

comment on function public.compute_bli(uuid) is
  'Returns the caller''s raw BLI with the canonical seven-level 0-800 display label. Raw scoring remains in obs_compute_bli_internal.';

alter table public.obs_learning_units
  drop constraint if exists obs_learning_units_score_ck;
alter table public.obs_learning_units
  add constraint obs_learning_units_score_ck
  check (baseline_display_score_required between 0 and 800);
alter table public.obs_learning_units
  alter column baseline_display_score_required set default 513;

-- This exact substitution is intentionally idempotent.
update public.obs_learning_units
set baseline_display_score_required = 513
where baseline_display_score_required = 585;

alter table public.obs_assessment_snapshots
  drop constraint if exists obs_assessment_snapshots_display_ck;
alter table public.obs_assessment_snapshots
  add constraint obs_assessment_snapshots_display_ck
  check (display_bli between 0 and 800);

update public.obs_assessment_snapshots
set display_bli = public.obs_display_score_from_raw(raw_bli),
    bli_level = public.obs_display_bli_level(
      public.obs_display_score_from_raw(raw_bli)
    );

revoke all on function public.compute_bli(uuid)
  from public, anon;
grant execute on function public.compute_bli(uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
