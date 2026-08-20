-- Scope-repair track (independent of the RLS/analytics remediation tracks).
--
-- Purpose: 34 of the 39 canonical Old Testament book scopes are absent from
-- public.assessment_scopes. Both focused-start RPCs
-- (obs_start_or_resume_ot_assessment / _v2) derive
-- assessment_attempts.scope_key from obs_learning_units.book_code and insert
-- it directly. The BEFORE INSERT/UPDATE trigger validate_assessment_attempt_scope()
-- currently checks only that the *derived testament* for a scope_key is
-- non-null and matches attempt.testament -- it never checks that the scope_key
-- has a parent row in assessment_scopes. Because canonical_assessment_scope()
-- and assessment_scope_testament() are fully hardcoded (independent of the
-- assessment_scopes table) and already know all 39 canonical OT books, that
-- check silently passes for a book with no assessment_scopes row, and the
-- INSERT falls through to assessment_attempts_scope_key_fkey, which raises a
-- raw Postgres foreign-key violation (reproduced in production as an HTTP 409
-- on a Joshua 1-12 focused retest). 18 of the 26 focused OT learning units
-- (covering 23 books) reference one of the 34 missing books, so this is not
-- Joshua-specific.
--
-- Owner: DB release owner (scope-repair track).
-- Dependencies: none on the RLS (Migration A) or analytics-idempotency
-- (Migration C) tracks; must not be combined with either.
--
-- This migration:
--   1. Verifies the canonical taxonomy (public.obs_biblical_books) is exactly
--      66 rows / 39 OT / 27 NT, and that no existing assessment_scopes book
--      row conflicts with that taxonomy.
--   2. Verifies the missing-key set is exactly the known 34-key baseline, or
--      empty (already repaired) -- fails closed on any other drift.
--   3. Inserts the missing OT book scopes using stable natural keys
--      (obs_biblical_books.book_code / section_key), assigning each to its
--      existing canonical section parent. No existing row is updated.
--   4. Replaces validate_assessment_attempt_scope() to add a controlled
--      SQLSTATE 22023 existence check *before* the testament check, so an
--      unconfigured scope is rejected with a controlled application error
--      instead of a raw FK violation. All pre-existing trigger behavior
--      (question_target/total_count sync on INSERT and UPDATE, testament
--      match, credential-mode restriction) is preserved byte-for-byte; only
--      the new existence guard is added. The foreign key
--      (assessment_attempts_scope_key_fkey) is retained unchanged as the
--      final integrity boundary.
--   5. Proves exhaustive postconditions: zero missing/mismatched canonical
--      books, zero learning-unit books without a scope, every existing
--      assessment_attempts.scope_key still resolves, and
--      canonical_assessment_scope()/assessment_scope_testament() agree with
--      the taxonomy for all 66 books.
--
-- Does not touch: assessment_attempts, assessment_answers,
-- obs_assessment_snapshots, obs_ot_attempt_context rows, obs_learning_units,
-- ot_generated_questions, scoring functions/values, or any object owned by
-- the RLS or analytics-idempotency tracks.
--
-- Rollback: supabase/rollbacks/20260802211500_seed_canonical_ot_book_assessment_scopes_rollback.sql
-- (guarded; refuses if any inserted key is referenced by an attempt).
--
-- Expected advisor impact: none. assessment_scopes already has policy
-- shared_read_assessment_scopes (anon/authenticated SELECT true) and is
-- already flagged pg_graphql_anon_table_exposed / _authenticated_table_exposed
-- as intentional public taxonomy exposure; adding rows to an already-exposed
-- table does not change that classification. No RLS/grant/index change is
-- made by this migration.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.assessment_scopes in share row exclusive mode;
lock table public.obs_biblical_books in share mode;

do $precondition$
declare
  v_missing text[];
  v_expected constant text[] := array[
    'JOS','JDG','RUT','1SA','2SA','1KI','2KI',
    '1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG',
    'ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON',
    'MIC','NAM','HAB','ZEP','HAG','ZEC','MAL'
  ];
begin
  if (select count(*) from public.obs_biblical_books) <> 66
     or (select count(*) from public.obs_biblical_books where testament = 'OT') <> 39
     or (select count(*) from public.obs_biblical_books where testament = 'NT') <> 27 then
    raise exception 'Canonical 66-book census is not the expected 39 OT / 27 NT';
  end if;

  if exists (
    select 1
    from public.obs_biblical_books b
    join public.assessment_scopes s on s.scope_key = b.book_code
    where s.scope_type <> 'book'
       or s.parent_scope_key is distinct from b.section_key
       or s.display_name is distinct from b.display_name
  ) then
    raise exception 'Existing canonical book scope conflicts with canonical taxonomy';
  end if;

  if exists (
    select 1
    from public.assessment_scopes s
    where s.scope_type = 'book'
      and not exists (
        select 1 from public.obs_biblical_books b where b.book_code = s.scope_key
      )
  ) then
    raise exception 'assessment_scopes contains a noncanonical book-type row';
  end if;

  if exists (
    select 1
    from public.obs_biblical_books b
    where not exists (
      select 1 from public.assessment_scopes p
      where p.scope_key = b.section_key and p.scope_type = 'section'
    )
  ) then
    raise exception 'A canonical section parent is missing from assessment_scopes';
  end if;

  select coalesce(array_agg(b.book_code order by b.canonical_order), array[]::text[])
    into v_missing
  from public.obs_biblical_books b
  left join public.assessment_scopes s on s.scope_key = b.book_code
  where s.scope_key is null;

  if v_missing <> v_expected and v_missing <> array[]::text[] then
    raise exception 'Unexpected partial assessment-scope drift: %', v_missing;
  end if;
end
$precondition$;

insert into public.assessment_scopes (
  scope_key,
  scope_type,
  parent_scope_key,
  display_name,
  description
)
select
  b.book_code,
  'book',
  b.section_key,
  b.display_name,
  b.display_name || ' assessment scope'
from public.obs_biblical_books b
left join public.assessment_scopes s on s.scope_key = b.book_code
where s.scope_key is null
order by b.canonical_order
on conflict (scope_key) do nothing;

-- Preserves the live trigger's exact pre-existing behavior (question_target /
-- total_count sync on INSERT and UPDATE, testament match, credential-mode
-- restriction). The only functional addition is the existence guard below,
-- which now runs before the testament lookup so an unconfigured scope fails
-- closed with a controlled SQLSTATE instead of reaching the FK.
create or replace function public.validate_assessment_attempt_scope()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_scope_testament text;
begin
  if tg_op = 'INSERT' then
    new.question_target := coalesce(new.question_target, new.total_count, 30);
    new.total_count := new.question_target;
  else
    if new.question_target is distinct from old.question_target then
      new.total_count := new.question_target;
    elsif new.total_count is distinct from old.total_count then
      new.question_target := new.total_count;
    end if;
  end if;

  if not exists (
    select 1 from public.assessment_scopes s where s.scope_key = new.scope_key
  ) then
    raise exception using
      errcode = '22023',
      message = format('Assessment scope %L is not configured', new.scope_key);
  end if;

  v_scope_testament := public.assessment_scope_testament(new.scope_key);

  if v_scope_testament is null then
    raise exception using
      errcode = '22023',
      message = format('Unsupported assessment scope: %s', new.scope_key);
  end if;

  if v_scope_testament <> new.testament then
    raise exception 'Assessment testament % does not match scope % (%)',
      new.testament, new.scope_key, v_scope_testament;
  end if;

  if new.assessment_mode = 'credential' and new.scope_key not in ('OT', 'NT') then
    raise exception 'Credential attempts must currently use an entire-testament scope';
  end if;

  return new;
end
$function$;

do $postcondition$
declare
  v_total_scopes integer;
  v_unresolved_attempts integer;
begin
  if exists (
    select 1
    from public.obs_biblical_books b
    left join public.assessment_scopes s on s.scope_key = b.book_code
    where s.scope_key is null
       or s.scope_type <> 'book'
       or s.parent_scope_key is distinct from b.section_key
       or s.display_name is distinct from b.display_name
  ) then
    raise exception 'Canonical book-scope coverage remains incomplete or inconsistent';
  end if;

  if exists (
    select 1
    from public.obs_learning_units u
    left join public.assessment_scopes s on s.scope_key = u.book_code
    where s.scope_key is null
  ) then
    raise exception 'A supported focused learning-unit book still lacks a scope';
  end if;

  select count(*) into v_unresolved_attempts
  from public.assessment_attempts a
  left join public.assessment_scopes s on s.scope_key = a.scope_key
  where s.scope_key is null;

  if v_unresolved_attempts <> 0 then
    raise exception 'An existing assessment_attempts.scope_key no longer resolves (%)', v_unresolved_attempts;
  end if;

  if exists (
    select 1
    from public.obs_biblical_books b
    where public.assessment_scope_testament(b.book_code) is distinct from b.testament
       or public.canonical_assessment_scope(b.book_code) is distinct from b.section_key
  ) then
    raise exception 'Canonical scope/testament functions disagree with book taxonomy';
  end if;

  select count(*) into v_total_scopes from public.assessment_scopes;
  if v_total_scopes <> 77 then
    raise exception 'assessment_scopes row count is % (expected 77 = 3 global + 8 section + 66 book)', v_total_scopes;
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.assessment_attempts'::regclass
      and tgname = 'trg_validate_assessment_attempt_scope'
      and not tgisinternal
  ) then
    raise exception 'trg_validate_assessment_attempt_scope trigger is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assessment_attempts'::regclass
      and conname = 'assessment_attempts_scope_key_fkey'
      and contype = 'f'
  ) then
    raise exception 'assessment_attempts_scope_key_fkey foreign key is missing';
  end if;
end
$postcondition$;

commit;
