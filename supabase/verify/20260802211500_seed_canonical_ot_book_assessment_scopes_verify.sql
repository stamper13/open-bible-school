-- Read-only scope-integrity regression.
-- Run before and after 20260802211500_seed_canonical_ot_book_assessment_scopes.sql
-- against the intended database. No writes; safe in production.
--
-- Scope-repair track only. Does not touch RLS/analytics-idempotency objects.

begin transaction read only;

-- 1. Canonical-book anti-join: every obs_biblical_books row must have a
--    matching assessment_scopes book row with the correct type/parent/name.
--    Expect zero rows before repair only for the 5 pre-existing Torah books;
--    expect zero rows overall after repair.
select b.book_code, b.display_name, b.testament, b.section_key,
  s.scope_key as existing_scope_key, s.scope_type, s.parent_scope_key
from public.obs_biblical_books b
left join public.assessment_scopes s on s.scope_key = b.book_code
where s.scope_key is null
   or s.scope_type <> 'book'
   or s.parent_scope_key is distinct from b.section_key
   or s.display_name is distinct from b.display_name
order by b.canonical_order;

-- 2. Learning-unit anti-join: every obs_learning_units.book_code must resolve
--    to an assessment_scopes row. Expect zero rows after repair.
select distinct u.book_code, u.section
from public.obs_learning_units u
left join public.assessment_scopes s on s.scope_key = u.book_code
where s.scope_key is null
order by u.book_code;

-- 3. Every book-type scope's parent section/global key must itself exist as
--    a scope row. Expect zero rows always.
select s.scope_key, s.parent_scope_key
from public.assessment_scopes s
where s.scope_type = 'book'
  and not exists (
    select 1 from public.assessment_scopes p where p.scope_key = s.parent_scope_key
  );

-- 4. Every canonical section/global scope referenced by the taxonomy exists.
--    Expect zero rows always.
select distinct b.section_key
from public.obs_biblical_books b
where not exists (
  select 1 from public.assessment_scopes p
  where p.scope_key = b.section_key and p.scope_type = 'section'
);

-- 5. Every existing assessment_attempts.scope_key resolves to a scope row.
--    Expect zero rows always (pre- and post-repair: this is additive-only).
select a.scope_key, count(*) as attempts
from public.assessment_attempts a
left join public.assessment_scopes s on s.scope_key = a.scope_key
where s.scope_key is null
group by a.scope_key;

-- 6. No attempt has a testament/scope mismatch.
select a.id, a.scope_key, a.testament, public.assessment_scope_testament(a.scope_key) as derived_testament
from public.assessment_attempts a
where public.assessment_scope_testament(a.scope_key) is distinct from a.testament;

-- 7. FK and validation trigger remain installed and valid.
select
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.assessment_attempts'::regclass
      and conname = 'assessment_attempts_scope_key_fkey'
      and contype = 'f'
  ) as fk_present,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.assessment_attempts'::regclass
      and tgname = 'trg_validate_assessment_attempt_scope'
      and not tgisinternal
      and tgenabled <> 'D'
  ) as trigger_present_and_enabled;

-- 8. Unknown/unconfigured scope keys have a controlled SQLSTATE contract:
--    static proof the live trigger body raises SQLSTATE 22023 for an
--    unconfigured scope, checked by source inspection (no write performed).
select
  position('errcode = ''22023''' in pg_get_functiondef(
    'public.validate_assessment_attempt_scope'::regproc
  )) > 0 as trigger_raises_22023,
  position('not exists' in pg_get_functiondef(
    'public.validate_assessment_attempt_scope'::regproc
  )) > 0 as trigger_checks_existence;

-- 9. Structural question, scoring, and snapshot counts remain unchanged by
--    this track (informational census; compare before/after runs).
select
  (select count(*) from public.ot_generated_questions) as question_rows,
  (select count(*) from public.assessment_attempts) as attempt_rows,
  (select count(*) from public.assessment_answers) as answer_rows,
  (select count(*) from public.obs_assessment_snapshots) as snapshot_rows,
  (select count(*) from public.obs_learning_units) as learning_unit_rows,
  (select count(*) from public.assessment_scopes) as scope_rows;

-- 10. Canonical scope/testament functions agree with the taxonomy for every
--     book. Expect zero rows always (these functions are fully hardcoded and
--     independent of the assessment_scopes table).
select b.book_code, b.testament, b.section_key,
  public.assessment_scope_testament(b.book_code) as derived_testament,
  public.canonical_assessment_scope(b.book_code) as derived_section
from public.obs_biblical_books b
where public.assessment_scope_testament(b.book_code) is distinct from b.testament
   or public.canonical_assessment_scope(b.book_code) is distinct from b.section_key;

rollback;
