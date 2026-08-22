# Local Schema Restore Drill

Date: 2026-08-21  
Baseline: `supabase/baseline/20260821011840_production_schema.sql`  
Runner: `scripts/restore-baseline-to-local-postgres-docker.sh`  
Target: disposable Docker container using `postgres:17`

## Result

PASS.

The schema-only baseline restored successfully into a disposable local
Postgres 17 database after applying the local Supabase compatibility prelude.
The SQL verifier suite also passed against that restored local database.

Verifier suite:

```bash
scripts/run-supabase-sql-verifiers.sh
```

Covered checks:

- frontend RPC contract
- frontend direct relation contract
- load-bearing RPC chain dependencies
- client-executable `SECURITY DEFINER` grant snapshot

## Compatibility Prelude

The local Docker target is plain Postgres, not the Supabase platform runtime.
The helper creates the minimum platform shims needed for a schema-only restore:

- roles: `anon`, `authenticated`, `service_role`, `supabase_admin`
- schemas: `auth`, `extensions`
- extensions: `pgcrypto`, `uuid-ossp`
- table: `auth.users`
- functions: `auth.uid()`, `auth.jwt()`

This prelude is local-test scaffolding only. It is not a migration and should
not be applied to a Supabase project.

## Supabase Branch Follow-Up

The Supabase preview branch `backend-cleanup`
(`cwsjtlovatphczdvaimb`) was created and is healthy, but it came up without the
application schema. To use it for cleanup testing, load the captured baseline
with:

```bash
TARGET_SUPABASE_DB_URL='postgresql://postgres:BRANCH_PASSWORD@db.cwsjtlovatphczdvaimb.supabase.co:5432/postgres' \
  scripts/load-supabase-schema-baseline-into-empty-branch.sh
```

Then run:

```bash
TARGET_SUPABASE_DB_URL='postgresql://...' scripts/run-supabase-sql-verifiers.sh
```
