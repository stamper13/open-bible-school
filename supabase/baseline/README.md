# Schema Baselines

This directory is for local schema-only dumps used during migration
reconciliation. Dump files are ignored by git because they can be large and
should be reviewed before any sanitized baseline is committed elsewhere.

Capture the current live schema with:

```bash
SUPABASE_DB_URL='postgresql://...' scripts/capture-supabase-schema-baseline.sh
```

Required local tools:

- `pg_dump`
- optionally `psql` for restore smoke tests
- optionally `supabase` CLI for linked-project/branch workflows

Homebrew installs `libpq` as keg-only on macOS, so `pg_dump` may exist at
`/opt/homebrew/opt/libpq/bin/pg_dump` without being on `PATH`. The capture
script checks that location automatically. You can also export:

```bash
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
```

Defaults:

- `BASELINE_SCHEMAS='public private'`
- `BASELINE_NAME='production_schema'`

After capture, restore the dump into a non-production target and run the
verification scripts before changing the migration chain.

Restore the latest local dump to an empty disposable Postgres target with:

```bash
TARGET_SUPABASE_DB_URL='postgresql://...' scripts/restore-supabase-schema-baseline.sh
```

Do not point `TARGET_SUPABASE_DB_URL` at production. The restore script asks for
`RESTORE` before running, but the connection string choice is still the real
safety boundary.

For a fresh Supabase preview branch that already has Supabase platform schemas
and an empty `public` schema, use the branch-specific loader instead:

```bash
TARGET_SUPABASE_DB_URL='postgresql://postgres:BRANCH_PASSWORD@db.BRANCH_REF.supabase.co:5432/postgres' \
  scripts/load-supabase-schema-baseline-into-empty-branch.sh
```

The branch loader strips `pg_dump` client meta-commands, makes schema creation
compatible with an initialized branch, rejects the production project ref, and
runs inside a single transaction. It also skips `ALTER DEFAULT PRIVILEGES`
statements because branch connections do not necessarily own Supabase platform
roles such as `supabase_admin`.

Supabase branches can also apply default function privileges for app roles while
the dump creates functions. The branch loader normalizes function ACLs at the
end by revoking branch-added function execute grants from `anon`,
`authenticated`, and `service_role`, then reapplying the function grants from
the captured baseline.

If a branch was loaded before that normalization step existed, repair only the
function ACL surface with:

```bash
TARGET_SUPABASE_DB_URL='postgresql://...' scripts/normalize-supabase-function-acls-from-baseline.sh
```

To run a fully local Docker smoke test without any Supabase branch credentials:

```bash
scripts/restore-baseline-to-local-postgres-docker.sh
```

Then run:

```bash
TARGET_SUPABASE_DB_URL='postgresql://...' scripts/run-supabase-sql-verifiers.sh
```

If these tools are unavailable, run
`supabase/diagnostics/schema_catalog_baseline.sql` as a read-only fallback and
save the findings under `supabase/review/`. The 2026-08-20 fallback snapshot is
`supabase/review/schema_catalog_baseline_2026-08-20.md`.
