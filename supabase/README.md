# Supabase Change Layout

Only forward, production-safe schema migrations belong in `migrations/`.
Supabase applies every SQL file in that directory when migrations are pushed.

> **Migration hold (updated 2026-08-20):** do not run `supabase db push` yet. The live
> project was changed through both dashboard migrations and manually executed
> repository files. The local directory contains repeated short migration
> versions such as `20260729`, while the remote ledger uses unique 14-digit
> versions. Run `scripts/check-supabase-migrations.sh` before any CLI migration
> operation. It intentionally fails until a live schema baseline has been
> captured and the legacy files have been archived or renumbered.

- `migrations/`: forward schema and function changes
- `rollback/`: explicitly invoked operational rollback scripts
- `verify/`: read-only or transaction-rolled-back verification scripts
- `manual/`: one-time data recomputations that intentionally persist changes
- `diagnostics/`: read-only investigation queries
- `baseline/`: ignored local schema dumps used during migration reconciliation

## Current backend shape

This backend is mostly a Supabase/Postgres application, not an app-server
codebase. Most behavior lives in RPC functions, triggers, views, and migrations.
That is workable, but the history is currently harder to understand than the
domain model:

- Production has 55 public tables, 153 public functions, and 31 public views.
- The production ledger has 194 migrations; latest verified version is
  `20260820123333 restore_ot_submit_chain`.
- The repo has both legacy 8-digit migration names and newer 14-digit versions.
- Several historical migrations patch functions by reading `pg_get_functiondef`
  and string-replacing the body. Treat those files as history, not as the
  preferred pattern for new work.
- The current frontend RPC contract is captured in
  `verify/frontend_rpc_contract_verify.sql`. Regenerate/check it with
  `node scripts/check-frontend-rpc-contract.mjs --write` or
  `npm --prefix web run test:rpc-contract`.
- Load-bearing internal RPC chains are captured in
  `verify/load_bearing_rpc_chain_verify.sql`.
- The intentional client-executable `SECURITY DEFINER` grant surface is
  snapshotted in `verify/security_definer_client_surface_verify.sql`.
- New active migrations are checked by `scripts/check-backend-repo-health.mjs`;
  it requires rollback/verify companions and blocks function-body mutation
  patches in migrations after the 2026-08-18 repair floor.
- The OT answer-submit outage from the 2026-08-18 cleanup is fixed in
  `migrations/20260820123333_restore_ot_submit_chain.sql` and verified by its
  companion file in `verify/`.

For new work, prefer complete `create or replace function` definitions with
preconditions, postconditions, explicit grants, and a companion rollback/verify
file. Avoid mutation-style function patches unless there is no safer option.

The baseline capture helper is `scripts/capture-supabase-schema-baseline.sh`.
See `docs/backend-organization-roadmap.md` for the cleanup order.

## Applying a change

1. Apply the matching file from `migrations/` in timestamp order.
2. Run its companion script from `verify/`.
3. Keep the rollback file available, but do not run it during normal deployment.
4. Record the applied migration in the deployment notes.

The current repository contains additive migrations for the existing project.
A schema-only dump of the live Supabase project is still needed before a fresh,
empty project can be recreated solely from this repository.

The current reconciliation record is in
`reconciliation/20260731_production_state.md`.
