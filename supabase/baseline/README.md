# Schema Baselines

This directory is for local schema-only dumps used during migration
reconciliation. Dump files are ignored by git because they can be large and
should be reviewed before any sanitized baseline is committed elsewhere.

Capture the current live schema with:

```bash
SUPABASE_DB_URL='postgresql://...' scripts/capture-supabase-schema-baseline.sh
```

Defaults:

- `BASELINE_SCHEMAS='public private'`
- `BASELINE_NAME='production_schema'`

After capture, restore the dump into a non-production Supabase project and run
the verification scripts before changing the migration chain.
