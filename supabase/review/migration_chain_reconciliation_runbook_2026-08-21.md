# Migration Chain Reconciliation Runbook

Date: 2026-08-21  
Current phase: Step 2.5 - migration-chain reconciliation  
Primary generated report:
`supabase/review/migration_chain_reconciliation.generated.md`

## Decision

Treat the current `supabase/migrations` directory as a historical patch log, not
as the canonical rebuild source.

Reason: a Supabase preview branch proved the chain cannot replay from zero. The
first concrete failure was
`20260730_anonymous_progress_transfer_hardening.sql`, which tried to alter
`public.user_abilities` before that table exists in the local chain. The static
analyzer confirms `public.user_abilities` is referenced by multiple migrations
and has no local create migration.

## Why Not Fix Every Old Migration

Replaying every historical migration would require reconstructing objects that
were created outside this repo, preserving exact intermediate function bodies,
and validating dozens of string-anchor function patches. The analyzer currently
reports 43 migration files with function-body mutation patterns. Repairing those
one-by-one would create a long, fragile archaeology project without improving
the future workflow enough to justify the risk.

## Preferred Path

1. Keep the verified schema-only baseline as the canonical current backend
   shape.
2. Preserve existing migrations for historical search, but move them out of the
   automatic replay path once the replacement chain is ready.
3. Create a new baseline-forward migration chain:
   - one baseline schema migration or restore artifact for current shape
   - one forward migration per new change
   - one rollback companion per new change
   - one verifier companion per new change
4. Keep all generated contract verifiers in `supabase/verify`.
5. Use Supabase preview branches for cleanup batches before production.

## Do Not Do

- Do not run `supabase db push`, `supabase migration up`, or migration repair
  commands against production while the replay path is unresolved.
- Do not delete old migrations until the replacement baseline-forward workflow
  is reviewed and tested.
- Do not infer that a relation/function is unused just because the local
  migration chain does not create it.
- Do not drop old OBS objects until deletion proof checks pass on a branch.

## Proposed Repo Layout

Future layout after explicit approval:

```text
supabase/
  migrations/
    20260821xxxxxx_baseline_public_private_schema.sql
    20260822xxxxxx_next_reviewed_change.sql
  migrations_archive/
    legacy_patch_log/
      20260710_...
      ...
  rollback/
    20260822xxxxxx_next_reviewed_change_rollback.sql
  verify/
    20260822xxxxxx_next_reviewed_change_verify.sql
    frontend_rpc_contract_verify.sql
    frontend_direct_relation_contract_verify.sql
    load_bearing_rpc_chain_verify.sql
    security_definer_client_surface_verify.sql
```

This is a proposal only. It should not be applied until the baseline migration
file is prepared, reviewed, restored into a fresh branch, and verified.

## Acceptance Criteria For Step 2.5

- Generated migration reconciliation report exists and is checked.
- First branch replay blocker is documented with exact file and relation.
- Function-body mutation risk is counted and visible.
- Misplaced rollback/verify files are documented.
- A baseline-forward strategy is recorded.
- No production DDL is performed.

## Command

Regenerate the report:

```bash
node scripts/analyze-supabase-migration-chain.mjs --write
```

Check freshness:

```bash
npm --prefix web run test:migration-chain
```
