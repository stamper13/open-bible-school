# Schema Catalog Baseline

Captured: 2026-08-20 23:01 UTC  
Project: `open-bible-school1` (`idyavsqksxtgogpfwlei`)  
Method: read-only Supabase MCP SQL queries.  
Scope: `public`, `private`, extension inventory, migration ledger summary.  
Limitation: this is a catalog baseline, not a full schema-only `pg_dump`.

## Why This Exists

The proper Step 2 target is still a schema-only dump that can be restored into a non-production project. That could not be completed locally today because:

- `SUPABASE_DB_URL` is not set in the shell.
- `supabase`, `pg_dump`, and `psql` are not available on `PATH`.

So this file captures the next-best artifact: a read-only catalog snapshot from production. It gives a senior developer a stable map of object counts, grants, comments, policies, and migration ledger state while we prepare the real dump workflow.

The reusable query is in `supabase/diagnostics/schema_catalog_baseline.sql`.

## Production Summary

| Area | Public | Private | Notes |
|---|---:|---:|---|
| Tables | 55 | 3 | All tables in both schemas have RLS enabled. |
| Views | 31 | 0 | Public views need explicit grant/security review because views can bypass RLS unless handled carefully. |
| Materialized views | 4 | 0 | All public. |
| Sequences | 2 | 0 | All public. |
| Functions | 153 | 4 | Public functions are the main application backend surface. |
| `SECURITY DEFINER` functions | 69 | 2 | This is the largest security/organization review surface. |
| Policies | 45 | 2 | Private policies are restrictive deny policies for anonymous transfer tokens. |
| Commented relations | 21 of 92 | 2 of 3 | Public relation comments need major improvement. |
| Commented functions | 56 of 153 | 0 of 4 | Function comments need domain/contract ownership labels. |

## Migration Ledger

Production migration rows: 194.

Latest 10 versions observed:

- `20260820123333`
- `20260820045806`
- `20260820045655`
- `20260820045620`
- `20260820045525`
- `20260818214407`
- `20260818212908`
- `20260818212701`
- `20260818005146`
- `20260817034636`

The repo currently has fewer local migration files than the live ledger, so production remains the source of truth until the full baseline dump is captured and restored.

## Extensions

| Extension | Schema | Version |
|---|---|---|
| `pg_graphql` | `graphql` | `1.5.11` |
| `pg_stat_statements` | `extensions` | `1.11` |
| `pgcrypto` | `extensions` | `1.3` |
| `plpgsql` | `pg_catalog` | `1.0` |
| `supabase_vault` | `vault` | `0.3.1` |
| `uuid-ossp` | `extensions` | `1.1` |

## Grant Baseline

Client relation grants are broader than the frontend access inventory requires.

| Grantee | SELECT grants | Non-SELECT relation grants |
|---|---:|---:|
| `anon` | 42 | 21 each for `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` |
| `authenticated` | 46 | 23-24 each for `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` |
| `service_role` | 88 | 86 each for `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` |

High-priority review targets with broad anon/authenticated mutation grants include:

- public views: `assessment_attempt_scope_health`, `question_coverage_status`, `question_coverage_summary`, `v_event_importance_current`, `v_oppressor_mcq_health`, `v_outline_node_events`
- reference/content tables: `bible_events`, `cross_references`, `obs_map_basemaps`, `obs_starfield_passages`, `question_coverage_targets`, `scripture_books`, `scripture_sections`, `scripture_verses`
- user-owned tables: `obs_reading_log_entries`, `obs_starfield_rewards`, `obs_study_plan_events`, `question_reports`, `user_abilities`, `users`

This does not prove data is currently exposed incorrectly, because RLS policies still apply on tables. It does prove the grant layer is noisy and harder to reason about than necessary.

## Data API Timing Note

Supabase has announced that new public tables will not be automatically exposed to the Data API by default, with enforcement for existing projects on 2026-10-30. Existing tables keep current grants, so this project’s older broad grants remain relevant and should be intentionally reduced rather than assumed away.

## Step 2 Status

Completed now:

- Read-only production catalog snapshot.
- Reusable SQL diagnostic for future branch/restored-project comparison.
- Baseline blockers recorded.
- Grant/comment/RLS summary recorded.
- Full schema-only dump captured on 2026-08-21; see `supabase/review/schema_baseline_capture_2026-08-21.md`.

Still needed:

- Restore the dump into a non-production project or Supabase branch.
- Run contract verifiers against that restored target.

## Recommended Next Action

Create a branch/restored target, then promote `supabase/review/account_deletion_cleanup_rpc_draft.sql` into a real migration and test it there. In parallel, prepare a grant-hardening migration that revokes broad non-SELECT client grants from views/reference tables first.
