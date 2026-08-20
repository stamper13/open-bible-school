-- Guarded rollback for
-- 20260802211500_seed_canonical_ot_book_assessment_scopes.sql
--
-- The 34 inserted book scopes should normally be retained: they are the fix
-- for the reproduced production defect. Deleting them after any focused
-- attempt has been created against one of them would violate referential
-- integrity intent and reopen the exact 409 this migration closed.
--
-- This rollback:
--   * refuses to run if any assessment_attempts row references one of the
--     34 inserted keys;
--   * does not delete, update, or touch assessment_attempts, answers,
--     snapshots, obs_ot_attempt_context rows, obs_study_plan_events,
--     learning units, questions, or scoring data;
--   * restores validate_assessment_attempt_scope() to its exact pre-migration
--     body (no scope-existence guard), captured verbatim from the live
--     definition read during the 2026-08-02 read-only investigation.
--
-- Operational precondition before running this in an incident: disable the
-- affected focused-assessment routes (frontend and/or RPC grants) first, so
-- no new attempt can be created against a key while this transaction runs.
--
-- Retaining the controlled-error trigger guard even if the seed rows are
-- rolled back: DO NOT restore the pre-migration trigger body unless you also
-- accept reopening the raw-FK-409 defect for any book that later loses its
-- scope row. If the seed rows are being rolled back only to investigate a
-- narrower issue (not to undo the fix), keep the current (post-migration)
-- trigger body and skip the trigger restore below -- the existence guard is
-- safe and correct independent of which rows currently exist. The trigger
-- restore step is included only for a full emergency reversal explicitly
-- authorized by the owner.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.assessment_scopes in share row exclusive mode;

do $guard$
declare
  v_keys constant text[] := array[
    'JOS','JDG','RUT','1SA','2SA','1KI','2KI',
    '1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG',
    'ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON',
    'MIC','NAM','HAB','ZEP','HAG','ZEC','MAL'
  ];
  v_referencing_count integer;
begin
  select count(*) into v_referencing_count
  from public.assessment_attempts
  where scope_key = any(v_keys);

  if v_referencing_count <> 0 then
    raise exception
      'Rollback refused: % assessment_attempts row(s) reference an added book scope. '
      'Disable affected focused routes and resolve those attempts before rollback.',
      v_referencing_count;
  end if;
end
$guard$;

delete from public.assessment_scopes
where scope_key = any(array[
  'JOS','JDG','RUT','1SA','2SA','1KI','2KI',
  '1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG',
  'ISA','JER','LAM','EZE','DAN','HOS','JOL','AMO','OBA','JON',
  'MIC','NAM','HAB','ZEP','HAG','ZEC','MAL'
]::text[]);

-- Full emergency reversal only (see note above): restores the exact
-- pre-migration trigger body, dropping the scope-existence guard. Skipped by
-- default; uncomment only with explicit owner authorization to fully reverse
-- the fix rather than merely remove the seeded rows.
--
-- create or replace function public.validate_assessment_attempt_scope()
-- returns trigger
-- language plpgsql
-- set search_path to 'public'
-- as $function$
-- declare
--   v_scope_testament text;
-- begin
--   if tg_op = 'INSERT' then
--     new.question_target := coalesce(new.question_target, new.total_count, 30);
--     new.total_count := new.question_target;
--   else
--     if new.question_target is distinct from old.question_target then
--       new.total_count := new.question_target;
--     elsif new.total_count is distinct from old.total_count then
--       new.question_target := new.total_count;
--     end if;
--   end if;
--
--   v_scope_testament := public.assessment_scope_testament(new.scope_key);
--   if v_scope_testament is null then
--     raise exception 'Unsupported assessment scope: %', new.scope_key;
--   end if;
--   if v_scope_testament <> new.testament then
--     raise exception 'Assessment testament % does not match scope % (%)',
--       new.testament, new.scope_key, v_scope_testament;
--   end if;
--   if new.assessment_mode = 'credential' and new.scope_key not in ('OT', 'NT') then
--     raise exception 'Credential attempts must currently use an entire-testament scope';
--   end if;
--   return new;
-- end
-- $function$;

commit;
