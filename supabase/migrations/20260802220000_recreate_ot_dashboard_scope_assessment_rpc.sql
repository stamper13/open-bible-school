-- Recreates public.obs_start_or_resume_ot_scope_assessment(text,text,integer,boolean).
--
-- Provenance: this is a NEW forward migration, not a replay of the historical
-- local file supabase/migrations/20260726_zzzzzzzzzz_dashboard_scope_assessments.sql.
-- That file's effects were never applied to production (the live migration
-- ledger has no row for it and the function does not exist in the live
-- catalog as of 2026-08-02). It is preserved unmodified as evidence; this
-- migration supersedes it with an updated body reconciled against the
-- current schema, not a copy.
--
-- Why the function is missing in production: unknown -- the historical file
-- was authored and left local-only (never committed to the pushed branch
-- history reachable from origin/main at the time, and never applied via the
-- Supabase migration ledger). No production DDL ever created or dropped
-- this function. This migration does not attempt to explain the gap further
-- than what is directly observable in the ledger and catalog.
--
-- Why it must be recreated now: the deployed production frontend bundle
-- (verified 2026-08-02 by downloading the live /assess route chunk from
-- https://web-navy-zeta-62.vercel.app and finding the literal RPC name and
-- exact named-argument set p_scope_key/p_label/p_target_question_count/
-- p_force_new) calls this RPC whenever a user opens an OT book or section
-- review card from the dashboard (web/app/page.tsx assessmentHrefForScore)
-- or the knowledge map (web/app/knowledge-map/page.tsx
-- sectionAssessmentHref / bookAssessmentHref). Every one of those clicks
-- currently fails at the PostgREST layer (schema-cache function-resolution
-- error, HTTP 404/PGRST202) before Postgres is ever reached -- distinct from
-- the assessment_attempts_scope_key_fkey 409 defect in the separate 34-book
-- scope-repair track. The downstream pipeline this RPC feeds is otherwise
-- fully wired: obs_get_next_ot_assessment_question -> get_next_assessment_question
-- -> obs_rank_ot_assessment_candidates_v4 already reads assessment_attempts
-- .scope_key and calls question_matches_assessment_scope to restrict
-- delivered questions to the requested book/section. Only the entry-point
-- RPC that creates/resumes the attempt is absent. Recreating it (repair
-- option A) is therefore the minimal correct fix; there is no existing RPC
-- a frontend change could redirect to (v1/v2 only support a single
-- focused learning unit or the whole-OT adaptive scope, never an
-- arbitrary section/book), and removing the route would delete working,
-- fully-wired product surface to paper over one missing function.
--
-- Exact differences from the historical 20260726 file (both read in full
-- before writing this migration):
--   1. SCOPE-EXISTENCE CHECK SOURCE (the one substantive behavioral change).
--      The historical body validated a requested scope against
--      public.obs_biblical_books (the pure canonical-taxonomy table), NOT
--      against public.assessment_scopes (the actual foreign-key target of
--      assessment_attempts.scope_key). Those two tables were asymmetric at
--      the time this migration was authored and remain asymmetric today
--      (only 5 of 39 OT book scopes exist in assessment_scopes). Deploying
--      the historical body unchanged would let any of the 39 canonical OT
--      book codes pass its own check and then reproduce the exact
--      assessment_attempts_scope_key_fkey raw-FK-409 defect from the
--      separate scope-repair track, for the 34 books whose assessment_scopes
--      row is still missing -- i.e. it would silently re-import the very
--      defect class that track exists to close. This migration instead
--      validates directly against assessment_scopes (scope_type in
--      ('book','section') and OT testament via assessment_scope_testament()),
--      which is the actual FK target, so a passed check can never reach the
--      FK. This is a strictly safer, self-consistent fix, not a stylistic
--      preference.
--   2. New precondition (not present historically) that fails closed unless
--      assessment_scopes already contains all 39 canonical OT book rows --
--      i.e. unless the separate 34-book scope-repair migration
--      (20260802211500_seed_canonical_ot_book_assessment_scopes.sql,
--      prepared but NOT YET DEPLOYED as of this migration's authoring) has
--      already been applied. This turns the required deployment ordering
--      between the two scope tracks into an enforced, fail-closed database
--      check instead of a documentation-only convention.
--   3. New precondition requiring that no overload of
--      obs_start_or_resume_ot_scope_assessment exists under any argument
--      signature, and a postcondition proving exactly one overload exists
--      after creation. Production currently has zero. Requiring zero also
--      makes the paired rollback safe: this migration can never replace a
--      pre-existing definition that the rollback would then drop.
--   4. Everything else -- ownership check, target/total_count/
--      target_question_count synchronization, resume-vs-new-attempt
--      selection logic, SECURITY DEFINER, fixed search_path, EXECUTE
--      revoked from public/anon and granted only to authenticated/
--      service_role, the schema-cache NOTIFY -- is preserved with the same
--      intent as the historical file; the historical file already got
--      those parts right.
--   5. No obs_study_plan_events row is emitted by this function, matching
--      the historical file exactly (adaptive scope attempts are not a
--      "retest" in the focused-learning-unit sense the event feeds). This
--      migration does not introduce any new event emission, so it cannot
--      introduce a new duplicate-event surface.
--
-- Does not touch: assessment_attempts, assessment_answers,
-- obs_assessment_snapshots, obs_ot_attempt_context rows, scoring functions
-- or values, question content, or any object owned by the RLS, analytics-
-- idempotency, or 34-book scope-repair tracks. Kept in its own migration
-- file, separate from all of those.
--
-- Rollback: supabase/rollback/20260802220000_recreate_ot_dashboard_scope_assessment_rpc_rollback.sql
-- Verify (read-only, static): supabase/verify/20260802220000_recreate_ot_dashboard_scope_assessment_rpc_verify.sql
-- Mutating branch-only fixture: supabase/manual/20260802220000_ot_scope_assessment_branch_fixture.sql

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.assessment_attempts') is null
     or to_regclass('public.assessment_scopes') is null
     or to_regclass('public.obs_biblical_books') is null
     or to_regclass('public.v_question_bank') is null
     or to_regclass('public.obs_ot_attempt_context') is null
     or to_regprocedure(
       'public.obs_get_next_ot_assessment_question(uuid)'
     ) is null
     or to_regprocedure(
       'public.question_matches_assessment_scope(text,text,text)'
     ) is null
     or to_regprocedure(
       'public.assessment_scope_testament(text)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Dashboard scope-assessment preflight failed; required contracts are missing.';
  end if;
end
$preflight$;

-- Enforced deployment ordering: this migration must not be applied before
-- the separate 34-book scope-repair migration has seeded every canonical OT
-- book scope. Deploying this RPC first would let a validated request for
-- any of the 34 still-missing books pass this function's own scope check
-- and then hit assessment_attempts_scope_key_fkey directly -- the same
-- defect class the scope-repair track exists to close.
do $ordering_precondition$
declare
  v_ot_book_scopes integer;
begin
  select count(*) into v_ot_book_scopes
  from public.assessment_scopes s
  where s.scope_type = 'book'
    and public.assessment_scope_testament(s.scope_key) = 'OT';

  if v_ot_book_scopes <> 39 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Refusing to deploy the OT scope-assessment RPC before the 34-book '
        'scope-repair migration lands: assessment_scopes has % OT book rows, '
        'expected 39.',
        v_ot_book_scopes
      );
  end if;
end
$ordering_precondition$;

do $overload_precondition$
declare
  v_existing_count integer;
begin
  select count(*) into v_existing_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'obs_start_or_resume_ot_scope_assessment';

  if v_existing_count <> 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Refusing to deploy: expected zero existing overloads of '
        'obs_start_or_resume_ot_scope_assessment, found %. Review the '
        'existing definition instead of replacing it.',
        v_existing_count
      );
  end if;
end
$overload_precondition$;

create function public.obs_start_or_resume_ot_scope_assessment(
  p_scope_key text,
  p_label text default null,
  p_target_question_count integer default 15,
  p_force_new boolean default false
)
returns table (
  attempt_id uuid,
  user_id uuid,
  assessment_kind text,
  scope_key text,
  unit_key text,
  label text,
  book_code text,
  start_chapter integer,
  end_chapter integer,
  target_question_count integer,
  available_question_count integer,
  answered_count integer,
  correct_count integer,
  idk_count integer,
  target_reached boolean,
  resumed boolean
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_scope_key text := upper(btrim(coalesce(p_scope_key, '')));
  v_scope_row public.assessment_scopes%rowtype;
  v_scope_label text;
  v_book_code text;
  v_available integer;
  v_target integer;
  v_attempt_id uuid;
  v_answered integer := 0;
  v_correct integer := 0;
  v_idk integer := 0;
  v_resumed boolean := false;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'An authenticated or anonymous Supabase session is required';
  end if;

  -- Validated against assessment_scopes -- the actual FK target of
  -- assessment_attempts.scope_key -- rather than obs_biblical_books (the
  -- historical file's source), so a passed check can never reach the FK.
  select s.* into v_scope_row
  from public.assessment_scopes s
  where s.scope_key = v_scope_key
    and s.scope_type in ('book', 'section');

  if not found or public.assessment_scope_testament(v_scope_key) <> 'OT' then
    raise exception using
      errcode = '22023',
      message = 'OT scope test must use a canonical section or Old Testament book code';
  end if;

  if v_scope_row.scope_type = 'book' then
    v_book_code := v_scope_key;
  end if;

  v_scope_label := coalesce(nullif(btrim(p_label), ''), v_scope_row.display_name);

  select count(distinct coalesce(
    nullif(question.payload->>'stem_family', ''),
    question.generated_question_id::text
  ))::integer
  into v_available
  from public.v_question_bank question
  where question.generated_question_id is not null
    and question.payload ? 'choices'
    and jsonb_typeof(question.payload->'choices') = 'array'
    and jsonb_array_length(question.payload->'choices') >= 2
    and public.question_matches_assessment_scope(
      question.book_code,
      'OT',
      v_scope_key
    );

  if coalesce(v_available, 0) = 0 then
    raise exception using
      errcode = 'P0002',
      message = 'No active questions are available for this Old Testament scope';
  end if;

  v_target := least(
    greatest(1, least(coalesce(p_target_question_count, 15), 50)),
    v_available
  );

  if not coalesce(p_force_new, false) then
    select attempt.id
    into v_attempt_id
    from public.assessment_attempts attempt
    where attempt.user_id = v_user_id
      and upper(coalesce(attempt.testament, 'OT')) = 'OT'
      and attempt.assessment_kind = 'ot_adaptive'
      and upper(coalesce(attempt.scope_key, '')) = v_scope_key
      and not exists (
        select 1
        from public.obs_ot_attempt_context context
        where context.attempt_id = attempt.id
      )
      and attempt.completed_at is null
      and not coalesce(attempt.is_complete, false)
      and (
        select count(*)
        from public.assessment_answers answer
        where answer.attempt_id = attempt.id
          and answer.user_id = v_user_id
      ) < greatest(
        1,
        coalesce(
          attempt.target_question_count,
          attempt.question_target,
          v_target
        )
      )
    order by attempt.created_at desc
    limit 1;
  end if;

  if v_attempt_id is not null then
    v_resumed := true;

    select
      count(*)::integer,
      count(*) filter (where answer.is_correct)::integer,
      count(*) filter (where coalesce(answer.is_idk, false))::integer
    into v_answered, v_correct, v_idk
    from public.assessment_answers answer
    where answer.attempt_id = v_attempt_id
      and answer.user_id = v_user_id;

    select greatest(
      1,
      coalesce(
        attempt.target_question_count,
        attempt.question_target,
        v_target
      )
    )
    into v_target
    from public.assessment_attempts attempt
    where attempt.id = v_attempt_id;
  else
    insert into public.assessment_attempts (
      user_id,
      prior_self_rating,
      testament,
      scope_key,
      assessment_mode,
      assessment_kind,
      question_target,
      target_question_count,
      total_count,
      answered_count,
      correct_count,
      is_complete
    ) values (
      v_user_id,
      3,
      'OT',
      v_scope_key,
      'adaptive',
      'ot_adaptive',
      v_target,
      v_target,
      v_target,
      0,
      0,
      false
    )
    returning id into v_attempt_id;
  end if;

  return query
  select
    v_attempt_id,
    v_user_id,
    'ot_adaptive'::text,
    v_scope_key,
    null::text,
    v_scope_label,
    v_book_code,
    null::integer,
    null::integer,
    v_target,
    v_available,
    v_answered,
    v_correct,
    v_idk,
    v_answered >= v_target,
    v_resumed;
end
$function$;

revoke all on function public.obs_start_or_resume_ot_scope_assessment(
  text, text, integer, boolean
) from public, anon;

grant execute on function public.obs_start_or_resume_ot_scope_assessment(
  text, text, integer, boolean
) to authenticated, service_role;

comment on function public.obs_start_or_resume_ot_scope_assessment(
  text, text, integer, boolean
) is
  'Starts or resumes a main adaptive OT assessment scoped to one canonical section or book. Recreated 2026-08-02 (new forward migration; see 20260726_zzzzzzzzzz_dashboard_scope_assessments.sql for the superseded historical draft) validating against assessment_scopes instead of obs_biblical_books.';

do $postcondition$
declare
  v_overload_count integer;
  v_def text;
begin
  select count(*) into v_overload_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'obs_start_or_resume_ot_scope_assessment';

  if v_overload_count <> 1 then
    raise exception 'Expected exactly one obs_start_or_resume_ot_scope_assessment overload, found %', v_overload_count;
  end if;

  select pg_get_functiondef(
    'public.obs_start_or_resume_ot_scope_assessment(text,text,integer,boolean)'::regprocedure
  ) into v_def;

  if strpos(v_def, 'SECURITY DEFINER') = 0 then
    raise exception 'Function is not SECURITY DEFINER';
  end if;
  if strpos(v_def, 'SET search_path TO ''public''') = 0 then
    raise exception 'Function does not pin search_path to public';
  end if;
  if strpos(v_def, 'from public.assessment_scopes') = 0 then
    raise exception 'Function no longer validates scope existence against assessment_scopes';
  end if;
  if strpos(v_def, 'obs_biblical_books') != 0 then
    raise exception 'Function unexpectedly still references obs_biblical_books for scope validation';
  end if;

  if has_function_privilege(
    'anon', 'public.obs_start_or_resume_ot_scope_assessment(text,text,integer,boolean)', 'execute'
  ) then
    raise exception 'anon must not retain EXECUTE on the scope-assessment RPC';
  end if;
  if not has_function_privilege(
    'authenticated', 'public.obs_start_or_resume_ot_scope_assessment(text,text,integer,boolean)', 'execute'
  ) then
    raise exception 'authenticated is missing EXECUTE on the scope-assessment RPC';
  end if;
end
$postcondition$;

notify pgrst, 'reload schema';

commit;
