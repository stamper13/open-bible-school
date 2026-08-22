# OT Assessment Repetition Findings - 2026-08-21

## User-visible problem

Anonymous first-time assessment testing often produced nearly the same OT
assessment. In practice this happened even though production has 1,171 eligible
OT question-bank rows.

## Evidence

- The frontend signs no-account users in with `supabase.auth.signInAnonymously()`,
  so anonymous learners use the authenticated OT assessment RPC flow.
- Default OT startup calls `obs_start_or_resume_ot_assessment_v2`; without a
  focused dimension it delegates to the ordinary OT baseline path.
- The app resumes unfinished attempts unless the route includes `fresh=1`, so
  same-browser testing can also look repeated if an anonymous attempt remains
  incomplete.
- Production question-bank metadata is uneven:
  - 1,171 eligible OT question rows.
  - 199 rows with payload `stem_family`.
  - 1,139 rows with column `dedupe_key`, but those values are effectively
    per-question rather than sibling-family keys.
- The live fast selector sorted fresh zero-history attempts by:
  1. content bucket,
  2. prior user history,
  3. section/dimension counts,
  4. fixed section order: Torah, Former Prophets, Latter Prophets, Writings,
  5. importance score,
  6. seeded hash.
- Because the seeded hash came last, fresh first questions were narrowed to a
  tiny high-importance Torah foundation bucket before any per-attempt
  diversification could matter.

## Fix

Migration `20260821125302_diversify_ot_baseline_fast_selector.sql`:

- Adds `obs_assessment_question_similarity_key(...)`, a conservative runtime
  duplicate key:
  - Prefer explicit `payload.stem_family`.
  - Fall back to close metadata siblings such as source-event/dimension/family,
    book/dimension/family/granularity, or book/type/correct-answer.
  - Fall back to normalized prompt for exact or near-exact prompt repeats.
- Updates `obs_get_next_ot_baseline_question_fast(...)` so in-attempt duplicate
  checks use the similarity key rather than only `stem_family`.
- Adds attempt-seeded section/book/question tie-breakers before fixed section
  order for the first four scored answers.
- Preserves existing gates for foundation-first behavior, division-taxonomy
  demotion, book-orientation caps, weak-section follow-up, and Latter Prophets
  probing.
- Keeps the app-facing surface unchanged.

## Verification

- Applied successfully to preview branch `backend-cleanup`
  (`cwsjtlovatphczdvaimb`).
- Structural verifier passed on the preview branch:
  `supabase/verify/20260821125302_diversify_ot_baseline_fast_selector_verify.sql`.
- Confirmed on branch:
  - Helper exists.
  - Fast selector is volatile.
  - Fast selector contains early seeded diversification tie-breakers.
  - Fast selector contains the similarity-key duplicate guard.
  - Fast selector remains executable by `authenticated` and `service_role`, not
    `anon`.
  - Helper is executable by `service_role`, not `anon` or `authenticated`.

## Follow-up

- Run a production-like data simulation after the migration is applied to an
  environment with question data.
- Longer term, backfill explicit `stem_family` or a curated sibling-family key
  across the OT question bank so runtime duplicate fallback can become simpler.
