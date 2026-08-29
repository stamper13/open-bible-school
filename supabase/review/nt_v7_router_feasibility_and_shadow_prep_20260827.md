# NT V7 Router Feasibility And Shadow Prep

Date: 2026-08-27

## Summary

NT should not reuse the OT V7 router directly. It should reuse the V7
philosophy: broad-to-narrow routing, cross-attempt novelty, similarity
suppression, long-run share brakes, and reduced priority for blunt
chapter-addressed prompts.

The app-facing NT chain is separate from OT and remains:

- `obs_start_nt_assessment`
- `obs_get_next_nt_assessment_question`
- `obs_submit_nt_assessment_answer`

This pass adds local shadow-prep files only. No production NT routing behavior
was changed.

## Live Data Findings

Production NT question bank profile:

- Live NT assessment questions: 319
- Valid choice payloads: 319
- NT rows with ladder metadata before this work: 0
- NT rows with `event_id`: 0
- Payload `stem_family`: 0 nonblank
- High-specificity/chapter-addressed by existing helper: 193/319

By division:

- Pauline: 140
- Gospels/Acts: 95
- General: 75
- Apocalypse: 9

Primary available NT routing signals:

- `book_code`
- `scripture_books.nt_division`
- payload `dimension_key` / `dimension`
- payload `question_layer`
- payload `chapter`
- payload `reference` / `source_ref`
- payload `expository_target`
- prompt text

Important difference from OT: NT has no event IDs in `v_nt_question_bank`, so
event coverage cannot be the main NT replay metric yet. For epistles,
argument/local-context coverage is more important than event chronology.

## Implemented Locally

Migration:

- `supabase/migrations/20260827110000_nt_router_v7_shadow_prep.sql`

Rollback:

- `supabase/rollback/20260827110000_nt_router_v7_shadow_prep_rollback.sql`

Verifier:

- `supabase/verify/20260827110000_nt_router_v7_shadow_prep_verify.sql`

The migration:

- Extends `obs_question_ladder_metadata` constraints so the sidecar can also
  hold NT section keys and `nt_overview`.
- Backfills provisional NT ladder metadata from `v_nt_question_bank`.
- Adds service-only `obs_rank_nt_assessment_candidates_v7`.
- Adds service-only `obs_log_nt_assessment_v7_shadow_selection`.
- Adds private `obs_router_nt_v7_shadow_log`.
- Does not modify `obs_get_next_nt_assessment_question`.
- Does not change scoring.

## NT-Specific V7 Differences

NT ladder sections should be:

- Gospels
- Acts
- Pauline Epistles
- General Epistles
- Apocalypse

The legacy/combined `GOSPELS_ACTS` scope still needs compatibility because old
links and attempts can reference it.

NT should treat the ladder differently by genre:

- Gospels/Acts can use event/order/geography logic similarly to OT narrative.
- Epistles should prioritize argument flow, local context, commands, theology,
  and structure.
- Revelation should have conservative share caps because the live bank only has
  9 questions.

## Validation

Local checks passed:

- `npm --prefix web run test:backend-repo`
- `npm --prefix web run test:migration-chain`
- SQL parse check with `pglast` passed for migration, rollback, and verifier.

Supabase branch probes:

- Non-production branch prerequisites exist.
- Branch NT ladder metadata was 0/319 before the new migration.
- A small constraint probe was applied and then reverted.
- Cleanup confirmed no NT V7 ranker, no NT V7 shadow log, and no NT ladder rows
  remained on the branch after cleanup.

Full migration was not applied to production. The MCP `execute_sql` payload limit
rejected the full file-sized SQL payload, so the next branch run should use
`psql`, Supabase CLI, or a secure local DB URL flow that does not expose
credentials in shell history.

## Recommendation

Next safest step:

1. Apply `20260827110000_nt_router_v7_shadow_prep.sql` to the Supabase branch
   using `psql` or Supabase CLI.
2. Run `20260827110000_nt_router_v7_shadow_prep_verify.sql`.
3. Run a 200-500 question NT shadow replay comparing current NT selector vs
   `obs_rank_nt_assessment_candidates_v7`.
4. Review NT ladder metadata samples, especially:
   - chapter-addressed prompts,
   - `structure_cross_ref`,
   - Revelation,
   - invalid/null dimensions,
   - prompt families that feel too similar despite no `stem_family`.
5. Only after the shadow replay looks good, add a tiny activation wrapper for
   `obs_get_next_nt_assessment_question` with current-NT fallback.

Do not activate NT V7 directly from the OT V7 activation pattern. The NT bank
needs its own replay gate because its event/stem metadata is much thinner.
