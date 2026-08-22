# Schema Baseline Capture

Captured: 2026-08-21 01:18:40 UTC  
Project: `open-bible-school1` (`idyavsqksxtgogpfwlei`)  
Method: `scripts/capture-supabase-schema-baseline.sh` using `pg_dump` from Homebrew `libpq`.

## Artifact

The schema-only dump is intentionally ignored by git and stored locally at:

```text
supabase/baseline/20260821011840_production_schema.sql
```

Companion checksum:

```text
supabase/baseline/20260821011840_production_schema.sql.sha256
```

Size and shape:

- SQL dump size: 779 KB
- SQL dump length: 22,117 lines
- Dumped database version: PostgreSQL 17.6
- Dumped by: `pg_dump` 18.6
- Schemas: `public`, `private`
- Flags: `--schema-only --no-owner`

SHA-256:

```text
b51da9149b7c947a1f4b36b1b32895c05e69af3164b8512dd3650a014489174a
```

## Status

Step 2 is now past the capture blocker. The dump has been restored successfully
to a disposable local Postgres 17 container using
`scripts/restore-baseline-to-local-postgres-docker.sh`.

The local restore needed a small Supabase compatibility prelude for roles,
`auth.users`, `auth.uid()`, `auth.jwt()`, and extensions. After that, the
schema-only dump restored cleanly and the SQL verifier suite passed.

Supabase preview branch status:

- Branch creation initially failed before the account upgrade.
- After the account was upgraded, branch creation succeeded on 2026-08-21 after
  cost confirmation for `$0.01344/hour`.
- Branch: `backend-cleanup`
- Branch id: `e4a460fc-d10c-45b4-87f5-9490e9884108`
- Branch project ref: `cwsjtlovatphczdvaimb`
- Parent project ref: `idyavsqksxtgogpfwlei`
- Initial status: `FUNCTIONS_DEPLOYED`, `ACTIVE_HEALTHY`
- Current status after Supabase attempted repo migrations: `MIGRATIONS_FAILED`,
  `ACTIVE_HEALTHY`
- Shape through the connector: empty app schema; no `public`/`private` tables,
  no migrations, and no edge functions.
- Failure evidence: Supabase tried to run
  `supabase/migrations/20260730_anonymous_progress_transfer_hardening.sql`
  against a blank branch and failed because `public.user_abilities` did not
  exist. This confirms the local migration chain is not currently replayable
  from zero.
- The parent database password does not authenticate to the branch database.
  Use the branch-specific database password/connection string from the Supabase
  dashboard before loading the baseline there.
- The captured baseline was later loaded manually into the branch using
  `scripts/load-supabase-schema-baseline-into-empty-branch.sh`.
- Function ACLs were normalized with
  `scripts/normalize-supabase-function-acls-from-baseline.sh`.
- Post-normalization verifier checks passed by connector inspection:
  frontend RPC contract, frontend direct relation contract, load-bearing RPC
  chain, and client-executable `SECURITY DEFINER` snapshot.

## Restore/Verification Commands

1. Load the dump into a fresh Supabase preview branch:

```bash
TARGET_SUPABASE_DB_URL='postgresql://postgres:BRANCH_PASSWORD@db.cwsjtlovatphczdvaimb.supabase.co:5432/postgres' \
  scripts/load-supabase-schema-baseline-into-empty-branch.sh
```

2. If function ACL normalization is needed on an already-loaded branch:

```bash
TARGET_SUPABASE_DB_URL='postgresql://...' scripts/normalize-supabase-function-acls-from-baseline.sh
```

3. Run local repo gates:

```bash
npm --prefix web run test:rpc-contract
npm --prefix web run test:data-access-contract
npm --prefix web run test:backend-repo
```

4. Run the SQL verifiers against the restored target:

```bash
TARGET_SUPABASE_DB_URL='postgresql://...' scripts/run-supabase-sql-verifiers.sh
```

- `supabase/verify/frontend_rpc_contract_verify.sql`
- `supabase/verify/frontend_direct_relation_contract_verify.sql`
- `supabase/verify/load_bearing_rpc_chain_verify.sql`
- `supabase/verify/security_definer_client_surface_verify.sql`

5. Compare the restored target to `supabase/review/schema_catalog_baseline_2026-08-20.md`.

Local restore verification already passed on 2026-08-21:

```bash
scripts/restore-baseline-to-local-postgres-docker.sh
```

Result: schema restore passed and
`scripts/run-supabase-sql-verifiers.sh` passed against the restored local
database.

## Security Note

The database password was typed into the shell command during capture and was also pasted into the assistant conversation. Rotate the Supabase database password after the baseline workflow is complete, and update any external direct Postgres clients that use the old password.
