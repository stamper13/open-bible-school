-- =====================================================================
-- 20260802220000_ot_scope_assessment_branch_fixture
-- =====================================================================
-- MUTATING, TRANSACTION-ROLLED-BACK FIXTURE. BRANCH/STAGING ONLY.
-- DO NOT RUN AGAINST PRODUCTION. SEPARATE, EXPLICIT, POST-APPROVAL STEP,
-- matching this repository's supabase/manual/ convention for mutating
-- scripts that must never run automatically.
--
-- Prerequisites (all require owner approval, separately from this file):
--   1. A Supabase development branch (or equivalent disposable staging
--      database), created only after explicit cost confirmation.
--   2. 20260802220000_recreate_ot_dashboard_scope_assessment_rpc.sql
--      already applied to that branch (its own ordering precondition
--      requires the 34-book scope-repair migration to be applied first;
--      apply both, in that order, before running this fixture).
--   3. The operator has explicitly approved running mutating fixtures in
--      this session:
--        set obs.allow_mutating_scope_rpc_tests = 'on';
--
-- What this file covers (SQL-layer only -- see the two follow-up manual
-- steps at the bottom of this header for what SQL cannot verify):
--   1. Every supported OT section/book scope currently in assessment_scopes
--      (testament, section, and book coverage as used by the frontend).
--   2. Unknown scope and a cross-testament scope (an NT book code).
--   3. A scope with SQLSTATE 22023, never a raw FK 23503, once the scope
--      does not exist in assessment_scopes (simulated by temporarily
--      deleting one book row inside this same rolled-back transaction).
--   4. New attempt creation (force_new not set, no prior attempt).
--   5. Resume behavior (second call without force_new reuses the attempt).
--   6. force_new behavior (explicit force_new => true creates a new attempt
--      even though a resumable one exists).
--   7. target_question_count / question_target / total_count consistency
--      after insert.
--   8. Ownership: a second synthetic user cannot resume/see the first
--      user's attempt (RLS + the function's own v_user_id = auth.uid()
--      scoping).
--   9. Exactly one function overload (repeats the migration's own
--      postcondition as a standalone check).
--  10. Zero obs_study_plan_events rows are created by any call in this
--      fixture (this RPC intentionally emits none; proves no duplicate-
--      event surface was introduced).
--  11. Complete transaction rollback: every fixture user, attempt, and
--      answer disappears; source counts are compared before/after.
--
-- What this file CANNOT verify (do these as separate, explicit steps on
-- the same branch after this fixture passes):
--   A. PostgREST named-argument resolution. This SQL fixture calls the
--      function directly in-database, which always resolves unambiguously
--      once only one overload exists (checked in item 9). To prove
--      PostgREST's own HTTP-layer argument-name resolution works, make one
--      real HTTP POST to the branch's
--      /rest/v1/rpc/obs_start_or_resume_ot_scope_assessment endpoint with
--      JSON body {"p_scope_key":"TORAH","p_label":"Torah",
--      "p_target_question_count":15,"p_force_new":false} using an
--      authenticated (or anonymous) branch session, and confirm HTTP 200
--      with the expected row shape -- not a PGRST202 function-not-found or
--      PGRST203 ambiguous-overload error.
--   B. Frontend behavior for every scope-generating route. Point a local or
--      preview build of web/ at the branch's Supabase URL/anon key and
--      click through: dashboard OT book cards, dashboard OT section cards
--      (Torah/Former Prophets/Latter Prophets/Writings), and the
--      knowledge-map page's equivalent book/section links
--      (sectionAssessmentHref, bookAssessmentHref). Confirm each starts an
--      assessment and delivers a first question with no console error.
-- =====================================================================

do $guard$
begin
  if coalesce(current_setting('obs.allow_mutating_scope_rpc_tests', true), '') <> 'on' then
    raise exception 'Refusing mutating scope-RPC fixtures outside an explicitly approved branch/staging session. Run: set obs.allow_mutating_scope_rpc_tests = ''on'';';
  end if;
end;
$guard$;

begin;

select
  (select count(*) from public.assessment_attempts) as attempts_before,
  (select count(*) from public.assessment_answers) as answers_before,
  (select count(*) from public.obs_study_plan_events) as events_before,
  (select count(*) from auth.users) as auth_users_before;

-- ---------------------------------------------------------------------------
-- Two synthetic authenticated users (rolled back with the transaction).
-- ---------------------------------------------------------------------------
create temporary table fixture_users as
select gen_random_uuid() as user_a, gen_random_uuid() as user_b;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmed_at, is_sso_user, is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000'::uuid, u.id, 'authenticated', 'authenticated',
  'scope-rpc-fixture-' || u.id::text || '@example.invalid',
  crypt('fixture-not-a-real-password', gen_salt('bf')),
  now(), '{"provider":"scope_rpc_fixture"}'::jsonb, '{}'::jsonb,
  now(), now(), now(), false, false
from (
  select user_a as id from fixture_users
  union all
  select user_b from fixture_users
) u;

create or replace function pg_temp.exec_as(p_user_id uuid, p_sql text) returns jsonb
language plpgsql as $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    execute 'set local role authenticated';
    execute p_sql into v_result;
    execute 'reset role';
    return jsonb_build_object('outcome', 'ok', 'result', v_result);
  exception when others then
    execute 'reset role';
    return jsonb_build_object('outcome', 'error', 'sqlstate', sqlstate, 'message', sqlerrm);
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Every supported OT section/book scope. Content-gap scopes (P0002) are
--    recorded as skipped, not failed -- same convention as the scope-repair
--    track's own matrix fixture.
-- ---------------------------------------------------------------------------
create temporary table fixture_scope_results (
  scope_key text, scope_type text, outcome text, detail jsonb
);

do $matrix$
declare
  v_scope record;
  v_call jsonb;
begin
  for v_scope in
    select s.scope_key, s.scope_type
    from public.assessment_scopes s
    where s.scope_type in ('book', 'section')
      and public.assessment_scope_testament(s.scope_key) = 'OT'
    order by s.scope_type, s.scope_key
  loop
    v_call := pg_temp.exec_as(
      (select user_a from fixture_users),
      format(
        'select to_jsonb(x) from public.obs_start_or_resume_ot_scope_assessment(%L, %L, 6, true) x',
        v_scope.scope_key, v_scope.scope_key
      )
    );

    if v_call->>'outcome' = 'ok' then
      if (v_call->'result'->>'scope_key') is distinct from v_scope.scope_key then
        raise exception 'Scope %: returned scope_key % does not match requested scope',
          v_scope.scope_key, v_call->'result'->>'scope_key';
      end if;
      insert into fixture_scope_results values (v_scope.scope_key, v_scope.scope_type, 'passed', v_call);
    elsif v_call->>'sqlstate' = 'P0002' then
      insert into fixture_scope_results values (v_scope.scope_key, v_scope.scope_type, 'skipped_no_questions', v_call);
    else
      insert into fixture_scope_results values (v_scope.scope_key, v_scope.scope_type, 'FAILED', v_call);
      raise exception 'Scope % unexpectedly failed: %', v_scope.scope_key, v_call;
    end if;
  end loop;
end;
$matrix$;

select outcome, count(*) from fixture_scope_results group by outcome order by outcome;
select * from fixture_scope_results where outcome = 'FAILED';

-- ---------------------------------------------------------------------------
-- 2. Unknown scope and cross-testament scope both fail with SQLSTATE 22023.
-- ---------------------------------------------------------------------------
do $negatives_unknown$
declare v_call jsonb;
begin
  v_call := pg_temp.exec_as(
    (select user_a from fixture_users),
    'select to_jsonb(x) from public.obs_start_or_resume_ot_scope_assessment(''NOT_A_REAL_SCOPE'', null, 15, true) x'
  );
  if v_call->>'outcome' <> 'error' or v_call->>'sqlstate' <> '22023' then
    raise exception 'Unknown scope did not fail with SQLSTATE 22023: %', v_call;
  end if;

  -- Cross-testament: MAT is a real assessment_scopes book row, but NT.
  v_call := pg_temp.exec_as(
    (select user_a from fixture_users),
    'select to_jsonb(x) from public.obs_start_or_resume_ot_scope_assessment(''MAT'', null, 15, true) x'
  );
  if v_call->>'outcome' <> 'error' or v_call->>'sqlstate' <> '22023' then
    raise exception 'Cross-testament scope (MAT) did not fail with SQLSTATE 22023: %', v_call;
  end if;

  raise notice 'Unknown and cross-testament scope negatives PASSED.';
end;
$negatives_unknown$;

-- ---------------------------------------------------------------------------
-- 3. A scope missing from assessment_scopes fails 22023, never a raw FK.
--    Temporarily removes one non-referenced book row inside this same
--    transaction, which rolls back at the end -- production data is never
--    at risk. Uses a book with zero existing attempts on this branch to
--    stay safe even if branch data differs from the assumption.
-- ---------------------------------------------------------------------------
do $negatives_missing_scope$
declare
  v_call jsonb;
  v_target_book text;
begin
  select s.scope_key into v_target_book
  from public.assessment_scopes s
  where s.scope_type = 'book'
    and public.assessment_scope_testament(s.scope_key) = 'OT'
    and not exists (
      select 1 from public.assessment_attempts a where a.scope_key = s.scope_key
    )
  order by s.scope_key
  limit 1;

  if v_target_book is null then
    raise notice 'Skipped missing-scope negative: every OT book scope on this branch already has an attempt.';
    return;
  end if;

  delete from public.assessment_scopes where scope_key = v_target_book;

  v_call := pg_temp.exec_as(
    (select user_a from fixture_users),
    format('select to_jsonb(x) from public.obs_start_or_resume_ot_scope_assessment(%L, null, 15, true) x', v_target_book)
  );

  if v_call->>'outcome' <> 'error' then
    raise exception 'Deleted-scope % unexpectedly succeeded: %', v_target_book, v_call;
  end if;
  if v_call->>'sqlstate' = '23503' then
    raise exception 'REGRESSION: deleted scope % reached the raw foreign key instead of the controlled 22023 guard.', v_target_book;
  end if;
  if v_call->>'sqlstate' <> '22023' then
    raise exception 'Deleted scope % failed with unexpected SQLSTATE %: %', v_target_book, v_call->>'sqlstate', v_call;
  end if;

  raise notice 'Missing-scope negative PASSED for %: controlled 22023, no raw FK.', v_target_book;
end;
$negatives_missing_scope$;

-- ---------------------------------------------------------------------------
-- 4/5/6/7. New attempt, resume, force-new, and target/total_count
--          consistency, all against TORAH (guaranteed present).
-- ---------------------------------------------------------------------------
do $lifecycle$
declare
  v_first jsonb;
  v_resume jsonb;
  v_forced jsonb;
  v_first_id uuid;
  v_resume_id uuid;
  v_forced_id uuid;
  v_row record;
begin
  v_first := pg_temp.exec_as(
    (select user_a from fixture_users),
    'select to_jsonb(x) from public.obs_start_or_resume_ot_scope_assessment(''TORAH'', ''Torah'', 6, false) x'
  );
  if v_first->>'outcome' <> 'ok' then
    raise exception 'New TORAH attempt failed: %', v_first;
  end if;
  v_first_id := (v_first->'result'->>'attempt_id')::uuid;
  if (v_first->'result'->>'resumed')::boolean is distinct from false then
    raise exception 'First call unexpectedly reported resumed=true: %', v_first;
  end if;

  select target_question_count, question_target, total_count
  into v_row
  from public.assessment_attempts where id = v_first_id;
  if v_row.target_question_count is distinct from v_row.question_target
     or v_row.question_target is distinct from v_row.total_count then
    raise exception 'target_question_count/question_target/total_count are inconsistent after insert: %/%/%',
      v_row.target_question_count, v_row.question_target, v_row.total_count;
  end if;

  v_resume := pg_temp.exec_as(
    (select user_a from fixture_users),
    'select to_jsonb(x) from public.obs_start_or_resume_ot_scope_assessment(''TORAH'', ''Torah'', 6, false) x'
  );
  if v_resume->>'outcome' <> 'ok' then
    raise exception 'Resume call failed: %', v_resume;
  end if;
  v_resume_id := (v_resume->'result'->>'attempt_id')::uuid;
  if v_resume_id <> v_first_id then
    raise exception 'Resume call created a new attempt instead of resuming: first=% resume=%', v_first_id, v_resume_id;
  end if;
  if (v_resume->'result'->>'resumed')::boolean is distinct from true then
    raise exception 'Resume call did not report resumed=true: %', v_resume;
  end if;

  v_forced := pg_temp.exec_as(
    (select user_a from fixture_users),
    'select to_jsonb(x) from public.obs_start_or_resume_ot_scope_assessment(''TORAH'', ''Torah'', 6, true) x'
  );
  if v_forced->>'outcome' <> 'ok' then
    raise exception 'force_new call failed: %', v_forced;
  end if;
  v_forced_id := (v_forced->'result'->>'attempt_id')::uuid;
  if v_forced_id = v_first_id then
    raise exception 'force_new => true unexpectedly reused the existing attempt';
  end if;

  raise notice 'New/resume/force-new/target-consistency lifecycle PASSED. attempts: new=%, resumed=%, forced=%', v_first_id, v_resume_id, v_forced_id;
end;
$lifecycle$;

-- ---------------------------------------------------------------------------
-- 8. Ownership: user_b cannot see or resume user_a's TORAH attempt.
-- ---------------------------------------------------------------------------
do $ownership$
declare
  v_call jsonb;
  v_a_attempt_id uuid;
  v_b_attempt_id uuid;
begin
  select attempt.id into v_a_attempt_id
  from public.assessment_attempts attempt
  where attempt.user_id = (select user_a from fixture_users)
    and attempt.scope_key = 'TORAH'
  order by attempt.created_at desc
  limit 1;

  v_call := pg_temp.exec_as(
    (select user_b from fixture_users),
    'select to_jsonb(x) from public.obs_start_or_resume_ot_scope_assessment(''TORAH'', ''Torah'', 6, false) x'
  );
  if v_call->>'outcome' <> 'ok' then
    raise exception 'user_b TORAH start failed: %', v_call;
  end if;
  v_b_attempt_id := (v_call->'result'->>'attempt_id')::uuid;

  if v_b_attempt_id = v_a_attempt_id then
    raise exception 'REGRESSION: user_b resumed user_a''s attempt (cross-user ownership leak).';
  end if;

  perform set_config('request.jwt.claim.sub', (select user_b::text from fixture_users), true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  if exists (
    select 1 from public.assessment_attempts where id = v_a_attempt_id
  ) then
    raise exception 'REGRESSION: user_b can read user_a''s attempt row (RLS ownership leak).';
  end if;
  reset role;

  raise notice 'Ownership/cross-user rejection PASSED.';
end;
$ownership$;

-- ---------------------------------------------------------------------------
-- 9. Exactly one function overload (standalone repeat of the migration's
--    own deploy-time postcondition).
-- ---------------------------------------------------------------------------
do $overload$
declare v_count integer;
begin
  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'obs_start_or_resume_ot_scope_assessment';
  if v_count <> 1 then
    raise exception 'Expected exactly one overload, found %', v_count;
  end if;
  raise notice 'Exactly-one-overload check PASSED.';
end;
$overload$;

-- ---------------------------------------------------------------------------
-- 10. Zero obs_study_plan_events rows were created by any call above.
-- ---------------------------------------------------------------------------
do $no_events$
declare v_count integer;
begin
  select count(*) into v_count
  from public.obs_study_plan_events e
  where e.user_id in (select user_a from fixture_users union select user_b from fixture_users);
  if v_count <> 0 then
    raise exception 'obs_start_or_resume_ot_scope_assessment unexpectedly created % obs_study_plan_events row(s); it must emit none.', v_count;
  end if;
  raise notice 'No-event-emission check PASSED (0 obs_study_plan_events rows).';
end;
$no_events$;

-- ---------------------------------------------------------------------------
-- 11. Roll back everything. Nothing from this fixture is ever committed.
-- ---------------------------------------------------------------------------
rollback;

-- After rollback, from a fresh read-only session on the same branch,
-- confirm counts match the "*_before" row captured at the top of this file:
--   select count(*) from public.assessment_attempts;
--   select count(*) from public.assessment_answers;
--   select count(*) from public.obs_study_plan_events;
--   select count(*) from auth.users;
-- Then complete the two follow-up manual steps (A and B) documented in the
-- header above before treating this RPC as release-ready.
