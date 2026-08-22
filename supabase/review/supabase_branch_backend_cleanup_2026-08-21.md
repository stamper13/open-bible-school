# Supabase Branch: Backend Cleanup

Date: 2026-08-21  
Parent project: `open-bible-school1` (`idyavsqksxtgogpfwlei`)  
Branch name: `backend-cleanup`  
Branch id: `e4a460fc-d10c-45b4-87f5-9490e9884108`  
Branch project ref: `cwsjtlovatphczdvaimb`  
Cost confirmed through connector: `$0.01344/hour`

## Status

The branch was created successfully after the account was upgraded to Pro.

Supabase initially reported:

- `status`: `FUNCTIONS_DEPLOYED`
- `preview_project_status`: `ACTIVE_HEALTHY`
- `with_data`: `false`

After Supabase attempted to run the repository migration chain, the branch
status changed to `MIGRATIONS_FAILED` while the preview project stayed
`ACTIVE_HEALTHY`.

The failure is expected from the current repo history and is useful evidence for
the cleanup project. Postgres logs show Supabase attempted:

```sql
ALTER TABLE public.user_abilities
  ADD COLUMN IF NOT EXISTS theta_se double precision NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS n_responses integer NOT NULL DEFAULT 0
```

and failed because `public.user_abilities` did not exist. This points to
`supabase/migrations/20260730_anonymous_progress_transfer_hardening.sql` and
confirms that the local migration chain is not a clean rebuild source yet.

Connector checks showed the branch currently has no application schema loaded:

- no `public` or `private` app tables
- no migrations
- no edge functions
- frontend RPC verifier returns all app-facing RPCs as missing

The branch still has the Supabase platform basics needed for a branch target:

- schemas: `auth`, `extensions`, `public`
- roles: `anon`, `authenticated`, `service_role`, `supabase_admin`, `postgres`
- extensions include installed `pgcrypto`, `uuid-ossp`, `pg_stat_statements`,
  `pg_net`, and `supabase_vault`

The parent Postgres password does not authenticate to the branch database, so
the branch has a separate database password.

## Baseline Load And Verification

The captured schema baseline was loaded into the branch after providing the
branch-specific database URL.

The raw restore first hit:

```text
permission denied to change default privileges
```

The branch loader was updated to strip `ALTER DEFAULT PRIVILEGES` statements,
which require ownership of Supabase platform roles and are not needed to verify
the current schema shape.

After the schema load completed, the SQL verifier suite initially failed with:

```text
FAIL: anon can execute an authenticated OT assessment RPC.
```

Connector inspection found 84 unexpected client-executable
`SECURITY DEFINER` grants. `scripts/normalize-supabase-function-acls-from-baseline.sh`
was added and run to repair the already-loaded branch by revoking branch-added
function execute grants from `anon`, `authenticated`, and `service_role`, then
reapplying the function grants from the captured baseline. The branch loader now
appends the same normalization automatically for future loads.

Post-normalization verification:

- frontend RPC existence: pass; 0 missing RPCs
- frontend direct relation existence: pass; 0 missing relations
- load-bearing RPC chain checks: pass
- client-executable `SECURITY DEFINER` snapshot: pass
- unpinned public `SECURITY DEFINER` function check: pass; 0 unpinned functions
- restored object counts match the baseline catalog:
  - `public`: 55 tables, 31 views, 4 materialized views, 2 sequences
  - `private`: 3 tables

Supabase still reports the branch deployment status as `MIGRATIONS_FAILED`
because of the earlier migration-chain replay failure. The preview project is
`ACTIVE_HEALTHY`, and the manually loaded baseline schema is present. Treat the
failed deployment status as evidence that the repo migration chain is not yet
replayable from zero, not as a failure of the baseline restore.

## Historical Commands

Get the branch database password/connection string from the Supabase dashboard,
then load the schema baseline into the empty branch:

```bash
TARGET_SUPABASE_DB_URL='postgresql://postgres:BRANCH_PASSWORD@db.cwsjtlovatphczdvaimb.supabase.co:5432/postgres' \
  scripts/load-supabase-schema-baseline-into-empty-branch.sh
```

The loader rejects the production ref and runs the restore in one transaction.
This is for branch verification only; it does not fix the repo migration chain
for merge workflows.

After it passes, run:

```bash
TARGET_SUPABASE_DB_URL='postgresql://...' scripts/run-supabase-sql-verifiers.sh
```

For a branch that was loaded before ACL normalization was added:

```bash
TARGET_SUPABASE_DB_URL='postgresql://...' scripts/normalize-supabase-function-acls-from-baseline.sh
```

## Advisor Follow-Up

Supabase advisors still flag cleanup work on the restored branch. The most
important categories are:

- security-definer views in `public`
- RLS enabled without policies on several internal/reference tables
- mutable search paths on old generator/helper functions
- authenticated-callable `SECURITY DEFINER` functions that are intentional but
  need formal contract documentation
- unindexed foreign keys and unused-index candidates

These are Phase 5/Phase 7 cleanup inputs. They are not blockers for the schema
baseline restore.

## Cleanup Reminder

Delete the preview branch when it is no longer needed so the hourly charge
stops.
