# Backend Organization Roadmap

Last updated: 2026-08-20.

## Current Rating

Backend: **6.75/10**.

The live product behavior is recoverable, the urgent frontend RPC contract is
repaired, and new repo gates now protect the riskiest edges. The schema history
is still too hard to reason about quickly. The backend is a Supabase/Postgres
application: most behavior lives in SQL functions, views, triggers, RLS
policies, and migration files rather than an app server.

## What A Senior Developer Will Notice First

- Production and the repository still need a schema baseline before normal
  Supabase CLI migration workflows are safe.
- The repository contains both old 8-digit migration versions and newer
  14-digit versions.
- Historical migrations often mutate existing function bodies with
  `pg_get_functiondef` plus string replacement. That makes the final body hard
  to know without replaying production.
- Many `SECURITY DEFINER` functions live in `public`; every one needs explicit
  grants and an auth/authorization check.
- The frontend/backend RPC contract now has a generated verifier:
  `supabase/verify/frontend_rpc_contract_verify.sql`.
- Load-bearing indirect RPC chains now have an explicit verifier:
  `supabase/verify/load_bearing_rpc_chain_verify.sql`.
- The client-executable `SECURITY DEFINER` grant surface is snapshotted in
  `supabase/verify/security_definer_client_surface_verify.sql`.
- Repo health gates now fail on new production migrations that lack rollback or
  verify companions, or that reintroduce function-body mutation patches.

## Path To 8/10

1. Capture a schema-only baseline from production using
   `scripts/capture-supabase-schema-baseline.sh`.
2. Restore that baseline into a non-production Supabase project.
3. Run the OT/NT lifecycle verification scripts, the generated frontend RPC
   contract verifier, and security advisor checks against that restored project.
4. Archive the legacy additive migration chain after the baseline is proven.
5. Require every new backend change to include forward SQL, rollback SQL,
   verification SQL, explicit grants, and pre/postconditions.
6. Replace mutation-style function patches with complete function definitions
   for all new work.

## Local Gates

Run these before opening a backend PR:

```bash
npm --prefix web run test:rpc-contract
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
