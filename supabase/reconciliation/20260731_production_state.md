# Production Database Reconciliation

Date: 2026-07-31

Supabase project: `idyavsqksxtgogpfwlei`

## Current State

- The live `supabase_migrations.schema_migrations` ledger contains 62 rows.
- Its latest recorded migration is `20260724025725 obs_compute_bli_precision_fix`.
- The repository contains 81 files in `supabase/migrations/`.
- Git currently tracks 45 of those migration files; 36 are untracked.
- The local filenames use eight-digit date prefixes and repeat versions heavily:
  25 files use `20260729`, 19 use `20260726`, and several other dates repeat.
- Later production changes were executed through the dashboard SQL editor. They
  are live and verified, but they are not represented in the remote migration
  ledger.

The live database is therefore the temporary source of truth. The repository is
an accurate change archive for recent work, but it is not yet a safe fresh-build
migration chain.

## Verified Live Changes Missing From The Ledger

The following recent changes were applied and verified in production but do not
appear in the 62-row remote migration ledger:

- OT router V4 policy, recovery, session brake, cross-session memory, and caps
- NT bank expansion and expository-quality changes
- Testament-separated BLI scores and NT profile scopes
- Anonymous progress-transfer hardening
- Legacy answer-key RPC privilege hardening
- Distractor calibration RLS
- Internal health-view hardening
- IDK weighting is live in `update_theta_internal`; its backup tag is present
- OT answer submission is first-write-wins and exact retries are idempotent
- OT V4 routing applies a current-session, dimension-local difficulty brake
- NT answer submission is first-write-wins and exact retries are idempotent
- Dormant credential-exam mutation RPCs are service-role only

This list is a verified minimum, not a substitute for a schema dump.

## Safety Rule

Do not run `supabase db push`, `supabase migration up`, or migration repair
commands against production until the baseline procedure below is complete.
`scripts/check-supabase-migrations.sh` must pass before those commands are used.

## Required Baseline Procedure

1. Create or designate a non-production Supabase project.
2. Link the CLI to production using a private local access token and database
   password; never commit either value.
3. Capture a schema-only dump of the live production database.
4. Store that dump as a uniquely versioned baseline outside the active legacy
   migration chain while it is reviewed for secrets, ownership, and data-only
   statements.
5. Restore the baseline into the non-production project.
6. Run the OT and NT lifecycle verification scripts, security assertions, and
   router simulations against that restored project.
7. Archive the current additive SQL files as historical change records.
8. Start a new active migration chain with unique 14-digit versions after the
   baseline.
9. Reconcile or squash the remote ledger only after the restored environment
   passes all verification. Never mark a migration applied merely because its
   filename resembles a live change.

## Completion Criteria

- A fresh non-production project can be recreated without dashboard copy/paste.
- All migration filenames have unique 14-digit versions.
- Local and remote migration lists agree.
- OT and NT assessment lifecycle tests pass on the recreated project.
- The security advisor has no errors on the recreated project.
- Production changes are performed through reviewed migration files thereafter.
