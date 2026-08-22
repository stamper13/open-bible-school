# Backend modernization master plan

Last updated: 2026-08-21  
Project: `open-bible-school1` (`idyavsqksxtgogpfwlei`)  
Scope: Supabase/Postgres backend, frontend/backend contract, schema organization, deletion/consolidation review.  
Safety posture: do not make production DDL directly. Use branches or reviewed migrations only.

## Goal

Make the backend understandable enough that a senior developer can quickly answer:

- What is the current API surface?
- Which tables and views are product-critical?
- Which functions are app-facing, internal, operational, legacy, or dead?
- What can be deleted safely?
- Which migrations explain architecture and which are historical repairs?
- How does a developer verify a backend change before release?

The backend is already a real system, not a toy schema. The improvement work should reduce cognitive load without breaking the assessment, scoring, routing, dashboard, admin, anonymous-transfer, or account-deletion flows.

## Non-negotiable safety rules

1. No production DDL or destructive data changes outside an approved migration/branch.
2. No object deletion based only on frontend grep.
3. Before dropping a function, check frontend calls, function-to-function calls, triggers, constraints, grants, comments, verification scripts, and historical restore notes.
4. Before dropping a table/view, check frontend direct access, server dynamic access, view dependencies, function dependencies, triggers, foreign keys, policies, grants, row counts, and operational scripts.
5. Keep public RPC signatures stable until frontend call sites and tests are updated in the same change.
6. Treat broad grants and `SECURITY DEFINER` functions as architecture, not incidental permissions.
7. Prefer documenting and locking down legacy code before deleting it.

## Phase 1 - Source map and usage inventory

Status: started on 2026-08-20.  
Primary artifacts:

- `supabase/review/frontend_backend_usage_inventory_2026-08-20.md`
- `supabase/review/frontend_direct_data_access.generated.md`
- `supabase/verify/frontend_direct_relation_contract_verify.sql`

Deliverables:

- A catalog of all frontend `.rpc()` calls.
- A catalog of all frontend/server `.from()` table and view calls, including dynamic table names.
- A load-bearing/internal RPC list that frontend grep does not catch.
- A first deletion-candidate list with risk level and required proof.
- A stale-coupling list where frontend still references removed or optional backend objects.

Acceptance gates:

- `npm --prefix web run test:rpc-contract`
- `npm --prefix web run test:data-access-contract`
- `npm --prefix web run test:backend-repo`
- Manual review of dynamic `.from(table)` call sites.

Why this comes first: cleanup without a source map already caused the 2026-08-18/2026-08-20 restore migrations. The first fix is to make reachability visible.

## Phase 2 - Canonical schema baseline

Status: baseline captured, restored locally, loaded into a Supabase preview
branch, and verified on 2026-08-21.  
Current artifact: `supabase/review/schema_catalog_baseline_2026-08-20.md`.  
Captured dump record: `supabase/review/schema_baseline_capture_2026-08-21.md`.  
Local restore drill: `supabase/review/local_schema_restore_2026-08-21.md`.  
Supabase branch record:
`supabase/review/supabase_branch_backend_cleanup_2026-08-21.md`.  
Reusable diagnostic: `supabase/diagnostics/schema_catalog_baseline.sql`.

Problem: the repo has 134 local migration files, 77 of them legacy short-version files, while production has 194 ledger rows. The repo is useful but not yet a clean rebuild source.

Deliverables:

- Capture a production schema-only baseline into `supabase/baseline/` using `scripts/capture-supabase-schema-baseline.sh`.
- Restore that baseline into a non-production project.
- Run lifecycle, RPC contract, and security verification scripts against the restored target.
- Decide whether to archive the legacy additive migration chain or renumber/reconcile it.

Current status:

- Full schema-only dump captured locally on 2026-08-21. The dump itself is gitignored under `supabase/baseline/`.
- Disposable local Docker restore passed on 2026-08-21 with `scripts/restore-baseline-to-local-postgres-docker.sh`.
- SQL verifiers passed against the restored local database.
- Supabase branch `backend-cleanup` (`cwsjtlovatphczdvaimb`) was created on 2026-08-21 after account upgrade and cost confirmation.
- The captured baseline was manually loaded into the branch and function ACLs were normalized from the baseline.
- Branch verifier checks pass: frontend RPC contract, direct relation contract, load-bearing RPC chain, and client-executable `SECURITY DEFINER` snapshot.
- Supabase marked the branch deployment `MIGRATIONS_FAILED` because the repo chain tried to alter `public.user_abilities` before that table existed. This is concrete proof that the repo migrations cannot yet rebuild the backend from zero.
- The remaining architecture blocker is deciding how to archive/reconcile the legacy additive migration chain so future branches can be rebuilt cleanly.

Acceptance gates:

- `scripts/check-supabase-migrations.sh` eventually passes.
- Baseline restore can reproduce public/private schema shape.
- Latest production ledger version is documented next to the baseline.

## Phase 2.5 - Migration chain reconciliation

Status: started on 2026-08-21.  
Primary artifacts:

- `supabase/review/migration_chain_reconciliation.generated.md`
- `supabase/review/migration_chain_reconciliation_runbook_2026-08-21.md`
- `scripts/analyze-supabase-migration-chain.mjs`

Problem: the verified branch baseline proves current schema can be restored,
but the local migration chain still cannot replay from zero. Supabase branch
replay failed at `20260730_anonymous_progress_transfer_hardening.sql` because
`public.user_abilities` was missing. The static analyzer also found 43
function-body mutation files and 2 rollback/verify files inside the migration
replay path.

Decision direction:

- Treat current migrations as a historical patch log.
- Keep production/baseline schema as the source of current truth.
- Prepare a reviewed baseline-forward migration chain.
- Preserve old migrations in an archive before removing them from replay.

Acceptance gates:

- Migration reconciliation report is generated and current.
- First branch replay blocker is documented.
- Baseline-forward runbook exists.
- No production DDL is performed.

## Phase 3 - Contract registry

Status: started on 2026-08-21.  
Primary artifacts:

- `supabase/docs/rpc-contracts.md`
- `supabase/docs/direct-data-access.md`

Problem: `supabase/verify/frontend_rpc_contract_verify.sql` protects existence of frontend-called RPCs, but it does not classify purpose, auth model, mutation behavior, or direct table/view access.

Deliverables:

- Human-readable RPC contract registry.
- Human-readable direct Data API access registry.
- Generated or semi-generated checks for both `.rpc()` and `.from()`.
- A compatibility table for wrappers and delegates.

Contract categories:

- browser/public read
- browser/authenticated read
- browser/authenticated write workflow
- server/admin/service-role only
- internal delegate
- trigger/constraint helper
- operational/manual
- deprecated/delete candidate

Acceptance gates:

- Every app-facing RPC has intended caller, auth model, mutation posture, and
  current grant shape.
- Every direct table/view access is either intentional or queued for RPC/grant
  cleanup.
- `scripts/check-backend-repo-health.mjs` requires the contract registry files.

## Phase 4 - Deletion and consolidation review

Status: first proof pass started on 2026-08-20 and extended on 2026-08-21.  
Primary artifacts:

- `supabase/review/deletion_candidates_2026-08-20.md`
- `supabase/review/deletion_proof_register_2026-08-21.md`
- `supabase/verify/legacy_candidate_reachability_verify.sql`

Problem: the live database still contains earlier OBS generations, generator functions, pilot RPCs, old wrappers, and operational helpers. Some are dead; some are load-bearing; some are merely not called by the frontend.

Initial candidate groups:

- old question generator/load functions:
  `generate_*_mcq_v1`, `get_mcq_event_entity_v1`, `mcq_pack_v1`, `load_generated_questions`, `backfill_questions_from_ot_generated`
- old NT pilot RPCs:
  `nt_get_pilot_questions`, `nt_submit_pilot_answer`
- locked-down credential exam helpers:
  `generate_full_exam`, `request_custom_exam`, `mark_exam_generated`, `submit_exam_results`
- compatibility wrappers/delegates:
  `get_next_assessment_question`, `get_next_scoped_assessment_question`, `obs_start_or_resume_ot_assessment`, `obs_submit_ot_assessment_response`, `submit_assessment_answer_v1`, `submit_assessment_answer_v2`
- old analysis/snapshot table names removed from account deletion code after live verification:
  `user_foundation_status`, `user_skill_ratings`, `obs_20260726_ability_before_answer_eligibility`, `obs_biblical_taxonomy_ability_backup`, `obs_biblical_taxonomy_bli_baseline`, `obs_idk_recompute_before`, `obs_idk_recompute_old_model`, `obs_idk_scope_census`

Deliverables:

- `supabase/review/deletion_candidates_YYYY-MM-DD.md`
- SQL verify script proving zero reachability before each drop batch.
- Branch migration for revoking grants first, dropping later.
- Rollback scripts that restore definitions from the verified baseline.

Current finding:

- The first 22-function candidate set has zero frontend/server references, zero
  current public/private function-body references, and zero trigger references
  on the `backend-cleanup` branch.
- Old generator/load helpers and `update_theta_from_answer_v1` are still
  client-executable in the baseline branch and now have a prepared
  grant-hardening migration:
  `supabase/migrations/20260821025851_legacy_candidate_rpc_grant_hardening.sql`.
  Branch verification is recorded in
  `supabase/review/legacy_candidate_grant_hardening_2026-08-21.md`.
- NT pilot and credential helpers are already service-role only; their drop risk
  is now mostly product/operations, not app reachability.

Acceptance gates:

- Zero frontend references.
- Zero function-body references from live public/private functions.
- Zero trigger/constraint dependencies.
- Zero view/materialized-view dependencies.
- Zero required admin/ops scripts.
- Row count and retention decision recorded.
- Branch smoke tests pass.

## Phase 5 - Grants, RLS, and Data API hygiene

Problem: RLS is broadly enabled, but several public tables/views still have broad client grants, including non-SELECT grants. Some may be harmless in practice; they are still hard to reason about.

Deliverables:

- `supabase/docs/security-model.md`
- `supabase/review/grants_surface_YYYY-MM-DD.md`
- Migration batches that revoke broad non-SELECT grants where not required.
- Tests proving intended browser/admin/service-role access.

Acceptance gates:

- Every public table/view has an intended grant model.
- All service-only relations are default-deny and commented.
- All client write workflows either use narrow RLS or RPC wrappers.

## Phase 6 - Domain architecture map

Deliverables:

- `supabase/docs/data-model.md`
- Table/view grouping by domain:
  - identity and account lifecycle
  - assessment attempts and answers
  - BLI/theta/scoring evidence
  - OT/NT routing
  - question bank and content taxonomy
  - admin/content QA
  - recommendation and study planning
  - starfield/cosmetic rewards
  - credential/printable assessment roadmap
  - historical/manual/operational objects

Acceptance gates:

- Every relation has one owner domain.
- Important relations have `COMMENT ON TABLE/VIEW`.
- Default-deny internal tables say so in comments.

## Phase 7 - SQL function refactor plan

Problem: some SQL functions are too large to safely edit without a local mental model.

Initial targets:

- `obs_rank_ot_assessment_candidates_v4` / `v5`
- `obs_get_next_ot_baseline_question_fast`
- `obs_submit_ot_assessment_response_v2`
- `obs_start_or_resume_ot_assessment_v2`
- `obs_compute_scoped_bli`
- `capture_bli_answer_scoring_evidence`

Deliverables:

- One design note per large function.
- Extract pure helper functions only after tests exist.
- Keep public RPC signatures stable.
- Prefer one behavioral concern per migration.

Acceptance gates:

- Existing lifecycle/regression tests pass before and after.
- Branch simulation outputs are compared for router changes.
- Any intentional behavior change has release notes.

## Phase 8 - Test and verification consolidation

Deliverables:

- `supabase/verify/README.md`
- `supabase/tests/README.md` if tests are separated from verify scripts.
- One command for safe branch regression.
- Labels for read-only, transaction-rolled-back, destructive, fixture-dependent, and production-unsafe scripts.

Acceptance gates:

- A new developer can run the safe suite without knowing migration history.
- Every active migration has rollback and verify companions.

## Phase 9 - Operational docs and recovery

Deliverables:

- Current backup/restore runbook linked from the backend README.
- Baseline restore drill notes.
- Supabase branch creation/rebase/deploy runbook.
- Production release checklist.

Acceptance gates:

- Recovery artifacts are documented and current.
- Release owner can tell which docs supersede older audit files.

## Phase 10 - App-side cleanup after backend verification

Deliverables:

- Remove stale dynamic account-deletion table names after confirming absent/nonneeded tables. Initial cleanup completed locally on 2026-08-20; full private-schema cleanup still needs a branch migration for `obs_delete_account_owned_data`.
- Replace direct table reads with RPCs where direct Data API exposure is not worth the grant/RLS complexity.
- Keep admin route service-role accesses documented.
- Add tests for account deletion and admin route schema drift.

Acceptance gates:

- Frontend unit/e2e tests pass.
- Backend direct-access inventory updates automatically or is manually updated in the same PR.

## Phase 11 - Long-term consolidation

Targets:

- Archive or squash the historical migration chain after baseline restore is proven.
- Move implementation-only tables/functions to `private` where practical.
- Reduce public helper-function execute grants.
- Remove or comment old generator/pilot/credential functions after proof.
- Convert repeated content-batch migrations into documented content import tooling.

Success marker:

The backend reaches the point where a senior dev can begin with `supabase/README.md`, read two or three docs, run one verification command, and know what not to touch.
