# Backend Organization Roadmap

Last updated: 2026-08-21.

## Current Rating

Backend: **6.75/10**.

The live product behavior is recoverable, the urgent frontend RPC contract is
repaired, and new repo gates now protect the riskiest edges. The schema history
is still too hard to reason about quickly. The backend is a Supabase/Postgres
application: most behavior lives in SQL functions, views, triggers, RLS
policies, and migration files rather than an app server.

## What A Senior Developer Will Notice First

- Production now has a captured schema-only baseline, a successful local restore
  drill, and a verified Supabase preview-branch restore. The repo migration
  chain still does not replay cleanly from zero.
- The repository contains both old 8-digit migration versions and newer
  14-digit versions.
- Historical migrations often mutate existing function bodies with
  `pg_get_functiondef` plus string replacement. That makes the final body hard
  to know without replaying production. The generated migration-chain report
  currently counts 43 function-body mutation files and confirms the branch
  replay failure around `public.user_abilities`.
- Many `SECURITY DEFINER` functions live in `public`; every one needs explicit
  grants and an auth/authorization check.
- The frontend/backend RPC contract now has a generated verifier:
  `supabase/verify/frontend_rpc_contract_verify.sql`, plus a human-readable
  registry at `supabase/docs/rpc-contracts.md`.
- Direct frontend Data API relation access now has a generated inventory and
  verifier: `supabase/review/frontend_direct_data_access.generated.md` and
  `supabase/verify/frontend_direct_relation_contract_verify.sql`, plus a
  human-readable registry at `supabase/docs/direct-data-access.md`.
- Load-bearing indirect RPC chains now have an explicit verifier:
  `supabase/verify/load_bearing_rpc_chain_verify.sql`.
- The client-executable `SECURITY DEFINER` grant surface is snapshotted in
  `supabase/verify/security_definer_client_surface_verify.sql`.
- Repo health gates now fail on new production migrations that lack rollback or
  verify companions, or that reintroduce function-body mutation patches.

## Path To 8/10

1. Capture a schema-only baseline from production using
   `scripts/capture-supabase-schema-baseline.sh`. A read-only catalog fallback
   exists at `supabase/review/schema_catalog_baseline_2026-08-20.md`, and the
   successful dump capture is recorded in
   `supabase/review/schema_baseline_capture_2026-08-21.md`.
2. Archive/reconcile the legacy additive migration chain now that the baseline
   is proven in a branch.
3. Finish the contract registry and make every app-facing direct access explicit.
4. Convert the branch advisor findings into prioritized security/performance
   cleanup batches.
5. Require every new backend change to include forward SQL, rollback SQL,
   verification SQL, explicit grants, and pre/postconditions.
6. Replace mutation-style function patches with complete function definitions
   for all new work.

For the fuller cleanup program, including deletion/consolidation gates and
frontend/backend cross-reference findings, see
`docs/backend-modernization-master-plan.md` and
`supabase/review/frontend_backend_usage_inventory_2026-08-20.md`. The first
deletion proof register is
`supabase/review/deletion_candidates_2026-08-20.md`. The local restore drill is
recorded in `supabase/review/local_schema_restore_2026-08-21.md`, and the
Supabase branch status is recorded in
`supabase/review/supabase_branch_backend_cleanup_2026-08-21.md`. Migration
chain reconciliation is tracked in
`supabase/review/migration_chain_reconciliation.generated.md` and
`supabase/review/migration_chain_reconciliation_runbook_2026-08-21.md`.

## Local Gates

Run these before opening a backend PR:

```bash
npm --prefix web run test:rpc-contract
npm --prefix web run test:data-access-contract
npm --prefix web run test:migration-chain
npm --prefix web run test:backend-repo
npm --prefix web run test:unit
```

The GitHub workflow in `.github/workflows/backend-contracts.yml` runs the same
contract and unit gates on pull requests.

## Working Rule

Until `scripts/check-supabase-migrations.sh` passes, production is still the
source of truth. New fixes may be applied as reviewed forward migrations, but do
not run `supabase db push`, `supabase migration up`, or migration repair commands
against production.
