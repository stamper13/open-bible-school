# Backend Organization Roadmap

Last updated: 2026-08-20.

## Current Rating

Backend: **5/10**.

The live product behavior is recoverable and the urgent frontend RPC contract is
now repaired, but the schema history is still too hard to reason about quickly.
The backend is a Supabase/Postgres application: most behavior lives in SQL
functions, views, triggers, RLS policies, and migration files rather than an app
server.

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

## Working Rule

Until `scripts/check-supabase-migrations.sh` passes, production is still the
source of truth. New fixes may be applied as reviewed forward migrations, but do
not run `supabase db push`, `supabase migration up`, or migration repair commands
against production.
