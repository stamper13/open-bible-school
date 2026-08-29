# V7 Question Ladder Metadata Human Review - 2026-08-24

## Scope

Reviewed the riskiest V7 metadata classes described in
`question_ladder_metadata_audit_20260824.md`, using the Task 3 deterministic
backfill rules and a read-only sample query against active OT question-bank
data. The active Supabase project did not yet have
`public.obs_question_ladder_metadata` applied, so review decisions are captured
as a follow-up migration:

- `supabase/migrations/20260824200000_v7_question_ladder_metadata_review.sql`
- `supabase/rollback/20260824200000_v7_question_ladder_metadata_review_rollback.sql`
- `supabase/verify/20260824200000_v7_question_ladder_metadata_review_verify.sql`

No production data was changed.

## Counts

- Rows manually sampled from the highest-risk query: 40
- Rows corrected: 16
- Rows flagged: 1
- Sampled rows left as `needs_review`: 23
- Larger unresolved review pools from the audit:
  - chapter-addressed prompts: 343
  - exact chapter recall prompts: 187
  - low-confidence deterministic labels: all rows below `0.7500`

## Corrected Examples

- Genesis 12:1-5 companion detail (`05381644-715a-4560-a9ad-52f22d6bc395`):
  changed from broad book-structure evidence to `verse_detail` / `passage`,
  `characters_lineage`, with low global signal.
- Abram altar location (`82de6030-86f0-4418-b9a0-2a09c843a844`): changed to
  passage-level `geography_nations`.
- Exodus 20 Sinai law (`033e38cc-81da-4470-8ebe-3a6822268308`): promoted from
  chapter detail to `unit_overview` / `unit`, `law_commands`, because it is
  foundational unit evidence.
- Babel judgment (`03fb9053-9604-4cfd-863b-a99afe4c9693`): promoted to
  `unit_overview`, because the event is foundational Genesis 1-11 storyline
  evidence.
- Genesis 12:3 universal promise (`01df1d7f-1dcb-4f08-b12e-bacfb155e9be`):
  promoted to `unit_overview`, `promise_prophecy`, because it is parent-scope
  Abrahamic-promise evidence despite a chapter-addressed prompt.

## Flagged Example

- Jeremiah oracles against nations (`1b583062-717d-47c9-bdf9-5800c0728100`):
  flagged as exact Jeremiah 46-51 chapter-range recall. It remains demoted and
  needs content review before carrying global routing weight.

## Recurring Problems

- `structure_cross_ref` was sometimes classified before high-specificity prompt
  checks, causing chapter-addressed rows to become `book_intersection` with
  elevated global signal.
- Some chapter-addressed prompts are genuinely foundational, so blanket demotion
  would be wrong. V7 needs both metadata and parent-scope gating.
- Several broad-looking prompts are actually local character, geography, or
  passage details and should not steer global BLI/routing by themselves.
- Exact chapter recall is the riskiest class for learner experience and should
  stay strongly demoted until reviewed.

## Shadow-Routing Readiness

Metadata is good enough for V7 shadow routing after this focused correction
because the V7 ranker demotes `needs_review`, `flagged`, chapter-addressed, and
exact-chapter rows. It is not good enough for live routing or shadow scoring
without more review of the remaining chapter-addressed/exact-recall pools.
