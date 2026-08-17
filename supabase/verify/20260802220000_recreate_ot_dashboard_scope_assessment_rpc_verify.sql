-- Read-only, static verification for
-- 20260802220000_recreate_ot_dashboard_scope_assessment_rpc.sql.
-- No writes. Safe to run against production at any time after deployment.

begin transaction read only;

-- 1. Exactly one overload exists.
select count(*) as overload_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'obs_start_or_resume_ot_scope_assessment';
-- expect: 1

do $$
declare
  v_definition text;
begin
  if to_regprocedure(
       'public.obs_start_or_resume_ot_scope_assessment(text,text,integer,boolean)'
     ) is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Dashboard scope-assessment function is missing.';
  end if;

  select pg_get_functiondef(
    'public.obs_start_or_resume_ot_scope_assessment(text,text,integer,boolean)'::regprocedure
  )
  into v_definition;

  -- 2. Canonical matching, adaptive routing, and safe resume isolation
  --    (same structural checks as the historical verify file).
  if strpos(v_definition, 'question_matches_assessment_scope') = 0
     or strpos(v_definition, 'assessment_kind = ''ot_adaptive''') = 0
     or strpos(v_definition, 'obs_ot_attempt_context') = 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'Scope assessment is missing canonical matching, adaptive routing, or safe resume isolation.';
  end if;

  -- 3. Scope-existence check is anchored to assessment_scopes (the FK
  --    target), not obs_biblical_books (the historical file's source and
  --    the root cause it would otherwise have reintroduced).
  if strpos(v_definition, 'from public.assessment_scopes') = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Scope-existence check is no longer anchored to assessment_scopes.';
  end if;
  if strpos(v_definition, 'obs_biblical_books') <> 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Function unexpectedly still references obs_biblical_books for scope validation.';
  end if;

  -- 4. Ownership, search_path, and SECURITY DEFINER contract.
  if strpos(v_definition, 'SECURITY DEFINER') = 0
     or strpos(v_definition, 'SET search_path TO ''public''') = 0
     or strpos(v_definition, 'auth.uid()') = 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'Function is missing SECURITY DEFINER, a fixed search_path, or the ownership check.';
  end if;
end
$$;

-- 5. Grants: authenticated/service_role can execute; anon/PUBLIC cannot.
select jsonb_build_object(
  'anon_denied', not has_function_privilege(
    'anon',
    'public.obs_start_or_resume_ot_scope_assessment(text,text,integer,boolean)',
    'execute'
  ),
  'public_denied', not has_function_privilege(
    'public',
    'public.obs_start_or_resume_ot_scope_assessment(text,text,integer,boolean)',
    'execute'
  ),
  'authenticated_granted', has_function_privilege(
    'authenticated',
    'public.obs_start_or_resume_ot_scope_assessment(text,text,integer,boolean)',
    'execute'
  ),
  'service_role_granted', has_function_privilege(
    'service_role',
    'public.obs_start_or_resume_ot_scope_assessment(text,text,integer,boolean)',
    'execute'
  )
) as grant_contract;
-- expect: all four true

-- 6. Every supported OT section/book scope resolves and has at least one
--    active question (the same content-availability gate the historical
--    verify file checked, extended from the 4 sections to all canonical
--    scopes this RPC now accepts).
with candidate_scopes as (
  select s.scope_key, s.scope_type
  from public.assessment_scopes s
  where s.scope_type in ('book', 'section')
    and public.assessment_scope_testament(s.scope_key) = 'OT'
),
scope_counts as (
  select
    scope.scope_key,
    scope.scope_type,
    count(distinct question.generated_question_id)::integer as available
  from candidate_scopes scope
  left join public.v_question_bank question
    on public.question_matches_assessment_scope(
      question.book_code,
      'OT',
      scope.scope_key
    )
   and question.payload ? 'choices'
   and jsonb_typeof(question.payload->'choices') = 'array'
   and jsonb_array_length(question.payload->'choices') >= 2
  group by scope.scope_key, scope.scope_type
)
select scope_key, scope_type, available
from scope_counts
order by (available = 0) desc, scope_type, scope_key;
-- expect: zero rows with available = 0 for release; any nonzero-available
-- row is a supported scope. Rows with available = 0 identify scopes that
-- will return the documented SQLSTATE P0002 (content gap, not an RPC
-- defect) until content coverage closes -- cross-reference against the
-- content-readiness gate before treating any such row as a release blocker.

-- 7. Cross-check: the ordering precondition this migration enforced at
--    deploy time still holds (all 39 canonical OT book scopes present).
--    If this ever returns non-39, something rolled back or deleted rows
--    outside this track.
select count(*) as ot_book_scope_count
from public.assessment_scopes s
where s.scope_type = 'book'
  and public.assessment_scope_testament(s.scope_key) = 'OT';
-- expect: 39

-- 8. Unindexed/orphaned scope_key values are out of this track's scope; see
-- the 34-book scope-repair track's own release-gate anti-joins for that.

rollback;
