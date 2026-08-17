# OT dashboard scope-assessment RPC — focused follow-up report

Date: 2026-08-02
Application repository: `/Users/stamper35/open-bible-school`
Frontend source: `/Users/stamper35/open-bible-school/web`
Supabase project: `open-bible-school1` (`idyavsqksxtgogpfwlei`), same live project as the
separate 34-book scope-repair track
Production-change posture: read-only investigation, then local file authoring only.
**Zero DDL/DML applied to production. No branch created. No cost incurred.**

Scope of this chat: `public.obs_start_or_resume_ot_scope_assessment(text,text,integer,boolean)`
only. Explicitly separate from, and does not edit/merge/renumber/deploy, the
completed 34-book scope-repair migration
(`/Users/stamper35/Documents/OBS/supabase/migrations/20260802211500_seed_canonical_ot_book_assessment_scopes.sql`).

## Verdict

**HOLD for production deployment. PASS for this track's local deliverables.**

## Is the route currently reachable and broken?

**Yes, both.** Verified two ways, not assumed from either alone:

1. **Live catalog**: `obs_start_or_resume_ot_scope_assessment` does not exist under
   any name/signature in `pg_proc` for the live project — confirmed by direct
   catalog query, not inferred from the historical migration's absence from the
   ledger.
2. **Live deployed bundle**: downloaded the actual production JS chunks served at
   `https://web-navy-zeta-62.vercel.app/assess` (not inferred from git branch
   state, which was ambiguous — see below) and found the literal RPC name and
   exact named-argument set `p_scope_key`/`p_label`/`p_target_question_count`/
   `p_force_new` byte-for-byte matching the local source in
   `web/app/assess/page.tsx`. The call is live in production today.

A git-ancestry check was run first and was **misleading on its own**: the commit
that introduced this feature (`11d1eee "Add dashboard book and section
assessments"`) is not an ancestor of `origin/main` on GitHub, which would suggest
the feature was never deployed. The live bundle download proved that assumption
wrong — Vercel is building from a source ahead of what's on `origin/main` (the
current checked-out branch `knowledge-map-star-hierarchy`, or a Vercel-specific
deploy source not tracked through the `origin` remote checked here). This is
flagged as a **release-process risk independent of this RPC**: the deployed
frontend cannot currently be verified against `origin/main`, so `git log
origin/main` is not a reliable proxy for "what's live." Do not use it as one
until deployment source is reconciled.

Because there is no PostgREST server-side function matching the name, every
click on an OT book or section review card in production today returns a
PostgREST schema-cache resolution failure (HTTP 404, `PGRST202`) **before
Postgres is ever reached** — no `assessment_answers` or `assessment_attempts`
row is at risk, and this never appears as a Postgres log entry, which is why a
search of the visible 24-hour Postgres/API log window found zero occurrences:
PGRST202 is resolved entirely inside PostgREST's schema-cache layer and never
proxies to the database. This is a **distinct failure mode** from the separate
34-book scope-repair track's `assessment_attempts_scope_key_fkey` defect (raw
Postgres FK violation, HTTP 409, which *does* reach Postgres) — the two tracks
were correctly kept separate.

### Every route/link that can trigger this call

| Source | Function | Scope values generated |
|---|---|---|
| `web/app/page.tsx` (dashboard) | `assessmentHrefForScore()` | Every canonical OT book code (`BIBLE_BOOKS` — the full 39-book list, not filtered to books with existing user answers) for book-kind cards; `TORAH`/`FORMER`/`LATTER`/`WRITINGS` for the four OT section cards |
| `web/app/knowledge-map/page.tsx` | `sectionAssessmentHref()` | `SECTION_SCOPE_KEYS[section]` — the same four OT section keys |
| `web/app/knowledge-map/page.tsx` | `bookAssessmentHref(bookCode)` | Any OT book code, again the full canonical list, not filtered |

The whole-OT canon card (`kind: "canon"`) and all NT cards route elsewhere
(`/assess` with no `scope` param, or the separate `testament=NT` /
`obs_start_nt_assessment` path) and are **not** affected by this defect.

## Historical migration: full inspection

Read in full, byte-for-byte, before writing anything:

- `supabase/migrations/20260726_zzzzzzzzzz_dashboard_scope_assessments.sql` (259 lines)
- `supabase/verify/20260726_zzzzzzzzzz_dashboard_scope_assessments_verify.sql` (77 lines)
- `supabase/rollback/20260726_zzzzzzzzzz_dashboard_scope_assessments_rollback.sql` (9 lines)

**All three preserved unmodified as evidence.** `git diff --stat` against the
working tree for all three shows zero changes.

### Dependency-by-dependency comparison against current live schema

| Dependency | Historical assumption | Current live state | Verdict |
|---|---|---|---|
| `assessment_attempts` columns/constraints | testament, scope_key, assessment_mode, assessment_kind, question_target, target_question_count, total_count, answered_count, correct_count, is_complete | Unchanged; all columns present, same types, same FK to `assessment_scopes` | No drift |
| `obs_biblical_books` | Used as the scope-existence source | Still exists, unchanged (66 rows, 39 OT/27 NT), but **is not the FK target** | Structurally fine, but wrong table to validate against (see below) |
| `v_question_bank` | book_code, generated_question_id, payload columns | Present, unchanged | No drift |
| `obs_get_next_ot_assessment_question(uuid)` | Delivers next question for an attempt | Still exists; for `assessment_kind='ot_adaptive'` it delegates to `get_next_assessment_question` → `obs_rank_ot_assessment_candidates_v4`, which **does reference `scope_key` and calls `question_matches_assessment_scope`** — confirmed by direct source inspection. The full downstream delivery pipeline already honors scope; only the entry-point RPC is missing. | Fully wired, no drift |
| `question_matches_assessment_scope(text,text,text)` | Canonical scope matcher | Unchanged; still delegates to `canonical_testament`/`canonical_assessment_scope`, the same fully-hardcoded taxonomy functions verified in the 34-book scope-repair track | No drift |
| `obs_ot_attempt_context` | Used to distinguish adaptive vs. focused attempts on resume | Unchanged | No drift |
| RLS | `obs_biblical_books`/`v_question_bank` locked to service-role; `assessment_scopes` has a public read policy | Confirmed identical to the state verified in the 34-book scope-repair track | No drift |
| Function ownership/SECURITY DEFINER/search_path/grants | SECURITY DEFINER, `search_path=public`, EXECUTE revoked from public/anon, granted to authenticated/service_role | Sibling RPCs (`obs_start_or_resume_ot_assessment[_v2]`) still use the identical pattern | Historical choice was already correct; preserved |
| `scoring_version` / target-count sync | Relies on table default `scoring_version=1`; explicitly writes `question_target`/`target_question_count`/`total_count` to the same value on insert | Unchanged; the live `validate_assessment_attempt_scope()` trigger's own sync logic (verified in the 34-book track) is a no-op on top of this because the RPC already writes all three consistently | No drift |

### The one substantive defect found

The historical function validates a requested scope against **`obs_biblical_books`**
(lines 72–92 of the historical file), not against **`assessment_scopes`** — the
actual foreign-key target of `assessment_attempts.scope_key`. Because
`canonical_assessment_scope()`/`canonical_testament()` are fully hardcoded and
already "know" all 39 canonical OT books (exactly the same root cause documented
in the 34-book scope-repair track's report), the historical check would pass for
*any* canonical OT book code — including the 34 that, as of this chat, still have
no `assessment_scopes` row, since the scope-repair migration has not been
deployed. Deploying the historical body unchanged today would let a user's book
click pass this function's own validation and then hit
`assessment_attempts_scope_key_fkey` directly — **re-importing the exact defect
class the other track exists to close**, for the section-mode entry point rather
than the focused-unit entry point. This is the only stale/unsafe statement found;
nothing else in the historical file is destructive, conflicting, or redundant.

## Chosen repair: Option A — new forward reconciliation migration

- **B (redirect the frontend)** does not fit: no existing RPC supports an
  arbitrary section/book adaptive scope. `obs_start_or_resume_ot_assessment[_v2]`
  only support one focused learning unit (by unit_key/book_code+chapter range) or
  the whole-OT adaptive scope (`scope_key='OT'` implicitly); neither can serve
  "adaptive questions restricted to Former Prophets" or "adaptive questions
  restricted to Ezekiel."
- **C (remove/feature-gate)** would delete a fully-wired product surface — the
  question-delivery pipeline already honors `scope_key` correctly end-to-end —
  to paper over one missing function, with no technical justification.
- **A** is minimal and correct: recreate the one missing function, fixing the
  one real defect (validate against `assessment_scopes`, not `obs_biblical_books`),
  and add a deploy-time precondition that makes the required ordering against the
  34-book scope-repair track an enforced database check rather than a documentation
  convention.

## Deliverables (local files only; nothing applied to production)

| File | Purpose |
|---|---|
| [`supabase/migrations/20260802220000_recreate_ot_dashboard_scope_assessment_rpc.sql`](../../supabase/migrations/20260802220000_recreate_ot_dashboard_scope_assessment_rpc.sql) | Forward migration: recreates the function validated against `assessment_scopes`; fails closed unless all 39 OT book scopes already exist; requires zero pre-existing overloads so rollback can never drop a replaced definition; asserts exactly one overload, SECURITY DEFINER, fixed search_path, and correct grants as postconditions; sends `notify pgrst, 'reload schema'` |
| [`supabase/rollback/20260802220000_recreate_ot_dashboard_scope_assessment_rpc_rollback.sql`](../../supabase/rollback/20260802220000_recreate_ot_dashboard_scope_assessment_rpc_rollback.sql) | Guarded drop; no data to protect (function-only migration) |
| [`supabase/verify/20260802220000_recreate_ot_dashboard_scope_assessment_rpc_verify.sql`](../../supabase/verify/20260802220000_recreate_ot_dashboard_scope_assessment_rpc_verify.sql) | Read-only, production-safe static verification |
| [`supabase/manual/20260802220000_ot_scope_assessment_branch_fixture.sql`](../../supabase/manual/20260802220000_ot_scope_assessment_branch_fixture.sql) | Mutating, transaction-rolled-back, branch-only fixture (guarded by `obs.allow_mutating_scope_rpc_tests`) |
| This file | Report and handoff |

No file outside this list was created or modified in this repository. The
historical 20260726 triad is untouched (`git diff` empty). All pre-existing
modified/untracked files from other work (`app/page.tsx`, the 20260728–20260731
migration batch, `docs/handoffs/`, etc.) are unrelated to this chat and were left
exactly as found.

## Differences between the historical migration and the safe current proposal

1. **Scope-existence check source** (the one behavioral fix): `assessment_scopes`
   instead of `obs_biblical_books`. This is what closes the defect described
   above; everything else about the validation logic (section keys, OT book
   restriction, controlled `22023` on failure) is unchanged in intent.
2. **New ordering precondition**: fails closed with `SQLSTATE P0001` unless
   `assessment_scopes` already contains all 39 canonical OT book rows — i.e.
   unless the 34-book scope-repair migration has already been applied. Not
   present historically.
3. **New overload preconditions/postconditions**: fails closed if a conflicting
   overload already exists; asserts exactly one overload, `SECURITY DEFINER`,
   pinned `search_path`, and the exact grant contract after creation. Not present
   historically (the historical verify file checked function-body content but not
   these catalog-level facts as migration-time gates).
4. Ownership check, resume/force-new logic, target/total_count synchronization,
   `SECURITY DEFINER`, fixed `search_path`, `revoke ... from public, anon` /
   `grant ... to authenticated, service_role`, and `notify pgrst, 'reload
   schema'` are **preserved unchanged** — the historical file already got these
   right.
5. No analytics event is emitted by either version. This migration does not add
   one, so it introduces no new duplicate-event surface (test item 10 in the
   branch fixture asserts zero `obs_study_plan_events` rows across the whole
   fixture).

## Tests completed this chat (read-only / catalog-only, against live production)

- Confirmed zero live overloads of the target function under any signature.
- Searched the visible 24-hour API and Postgres log windows for this RPC name;
  zero occurrences in either (expected, given the PGRST202 failure mode never
  reaches Postgres, and API log retention did not happen to capture a recent
  attempt).
- Read the exact frontend call site (`web/app/assess/page.tsx`), its argument
  names/types, expected return row shape (`OtAssessmentStartRow`), subsequent
  navigation (`loadQuestion` → `obs_get_next_ot_assessment_question`), and error
  handling (generic `setErrorMsg`/`setPhase("error")`; no special-case handling
  for this RPC's specific failure mode).
- Enumerated every scope-generating route/link and its actual scope-value
  domain (table above).
- Verified reachability by downloading and grepping the live deployed JS bundle
  — ground truth, not inferred from git state alone (git state was independently
  checked and found to be an unreliable proxy here, which is itself reported
  above as a risk).
- Read all three historical files in full; diffed every dependency against
  current live schema, RLS, grants, and function bodies, including one level
  deeper than requested (`get_next_assessment_question` →
  `obs_rank_ot_assessment_candidates_v4`) to confirm the downstream delivery
  pipeline actually honors `scope_key` today.
- Confirmed the five preflight objects the historical migration required
  (`assessment_attempts`, `obs_biblical_books`, `v_question_bank`,
  `obs_get_next_ot_assessment_question(uuid)`,
  `question_matches_assessment_scope(text,text,text)`) all still resolve live,
  with unchanged definitions for the ones inspected.
- No attempt, answer, or auth user was created in production at any point.

## Tests awaiting shared-branch validation (not run; require the shared branch)

Per your standing instruction, this repair will be applied on the same shared
branch as the RLS, scope, and analytics repairs once the backup and analytics
tracks are complete and branch cost is explicitly approved. On that branch,
before production deployment:

1. Every supported OT section/book scope currently in `assessment_scopes` (all
   39 books + 4 sections, once the 34-book migration has also landed on the
   branch).
2. Unknown scope and cross-testament scope (e.g. `MAT`) both rejected with
   `22023`.
3. A scope deleted from `assessment_scopes` mid-fixture rejected with `22023`,
   never a raw `23503`.
4. New attempt creation.
5. Resume behavior (second call reuses the same attempt).
6. `force_new => true` behavior (creates a new attempt despite a resumable one).
7. `target_question_count`/`question_target`/`total_count` consistency after
   insert.
8. Ownership: a second synthetic user cannot resume or read the first user's
   attempt.
9. Exactly one function overload (repeated as a standalone branch-time check).
10. Zero `obs_study_plan_events` rows created by any call in the fixture.
11. Full transaction rollback with before/after row-count parity.
12. **PostgREST named-argument resolution** — requires one real HTTP call to the
    branch's `/rest/v1/rpc/obs_start_or_resume_ot_scope_assessment` endpoint;
    cannot be exercised from a SQL client and is documented as a required
    follow-up step in the fixture file's header, not embedded as SQL.
13. **Frontend behavior for every scope-generating route** — requires pointing a
    local/preview build of `web/` at the branch and clicking through every
    dashboard and knowledge-map book/section card; also documented as a required
    follow-up step, not something a SQL fixture can verify.

## Required deployment order

1. `20260802211500_seed_canonical_ot_book_assessment_scopes.sql` (34-book
   scope-repair track; already prepared, not yet deployed) **must** land first.
   This migration's own precondition enforces that at deploy time — it will
   fail closed with a clear message rather than silently deploying out of
   order.
2. `20260802220000_recreate_ot_dashboard_scope_assessment_rpc.sql` (this track)
   second.
3. No ordering dependency exists against the RLS repair
   (`20260802210500_secure_semantic_distractor_reviews.sql`) or the analytics
   idempotency track — neither shares an object with this migration.
4. All three (RLS, 34-book scope-repair, this RPC) plus the analytics track are
   intended for the same shared branch per your instruction; within that branch,
   only the ordering constraint in item 1 is mandatory.

## Owner decisions required

1. Reconcile what Vercel actually deploys from — the discrepancy between
   `origin/main`'s git history and the live bundle's contents (this RPC's
   commit is not on `origin/main` but is in the live bundle) should be resolved
   independent of this fix, so future "is X deployed" questions can be answered
   from git alone.
2. Approve the shared branch (cost confirmation still pending per your
   standing instruction) once the backup and analytics tracks report complete.
3. Approve running the branch-only fixture and the two follow-up manual steps
   (PostgREST HTTP call, frontend click-through) on that branch.
4. Approve production deployment of this migration, strictly after the 34-book
   scope-repair migration, on the shared branch's schedule.

## Confirmation: production and both Git indexes unchanged

- **Production**: only `execute_sql` (read-only SELECT), `get_logs`, and
  `get_advisors`-equivalent read calls were made. No `apply_migration` call was
  made. No branch was created. No cost was confirmed or incurred.
- **`/Users/stamper35/open-bible-school` git index**: `git status --short`
  shows only the 4 new files listed above as untracked additions from this
  chat; every previously modified (`M`) or untracked (`??`) file from prior
  work is unchanged. Nothing was staged, committed, pushed, or opened as a PR.
- **`/Users/stamper35/Documents/OBS` git index**: the 34-book scope-repair
  track's four files remain exactly as they were left at the end of that
  chat — untracked, unedited, unrenumbered, undeployed. Nothing in that
  workspace was touched by this chat.
