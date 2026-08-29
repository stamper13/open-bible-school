# Production V6 Step 23 Repeat Hardening - 2026-08-25

## Scope

Follow-up to the production V7 shadow/performance rollout.

Goal: remove the remaining production replay exact/similarity repeat leaks while
keeping V7 shadow-only and preserving the app-facing RPC chain.

Production live routing remains:

- `active_version`: `V6`
- `campaign_enabled`: `true`
- V7: installed, shadow-only, not live

## Diagnosis

After the first production rollout replay, aggregate repeats remained:

- Cross-attempt exact repeat rows: 2
- Similarity-cluster repeat rows: 2

I enhanced `supabase/verify/asymmetric_scripture_200_router_simulation.sql` to
return exact and similarity repeat details. A diagnostic production-safe replay
then showed the residual leak was a repeated book-orientation item:

- Prompt: "Which book reflects on life under the sun, the limits of human toil,
  and the fleeting character of earthly gain?"
- Book: `ECC`
- Question type: `book_orientation_mcq_v1`
- Similarity key: `book_orientation|ECC`

This pointed to the public next-question wrapper selection path, not scoring.

## Implemented

Added and applied:

- `supabase/migrations/20260825203000_router_v6_23_app_wrapper_cross_attempt_novelty.sql`
- `supabase/rollback/20260825203000_router_v6_23_app_wrapper_cross_attempt_novelty_rollback.sql`
- `supabase/verify/20260825203000_router_v6_23_app_wrapper_cross_attempt_novelty_verify.sql`

The migration updates `get_next_assessment_question` so the first V6/V5
selection passes skip cross-attempt exact and similarity repeats when another
ranked candidate is available. The existing relaxed fallback remains available
so an exhausted pool can still return a question instead of freezing.

## Verification

Passed locally:

- `npm --prefix web run test:backend-repo`
- `npm --prefix web run test:migration-chain`

Passed on branch:

- Step 23 migration apply
- Step 23 verifier

Passed on production:

- Step 23 migration apply
- Step 23 verifier
- App-facing one-question smoke

## Replay After Step 23

Production-safe 200-question replay completed.

- Total rows: 200
- Scored rows: 200
- Distinct questions: 200
- Within-attempt exact repeats: 0
- Cross-attempt exact repeat rows: 0
- Similarity-cluster repeat rows: 0
- Unsupported order/drag rows: 0
- Chapter-addressed rows: 8
- High-specificity rows: 8
- Overall accuracy: 59.0%
- IDK rate: 10.5%

Distribution:

- Latter Prophets: 89/200
- Torah: 46/200
- Writings: 33/200
- Former Prophets: 32/200
- `theological_reasoning`: 50/200
- `promise_prophecy`: 49/200
- `events_timeline`: 36/200
- `characters_lineage`: 26/200
- `geography_nations`: 20/200
- `law_commands`: 19/200

## Rejected Follow-Up

I tested a separate step 24 wrapper-level dimension max-share gate intended to
push `promise_prophecy` lower. It passed static verifiers, but the full replay
became too slow. I cancelled the replay and rolled step 24 back from production
and the branch.

Final production state:

- Step 23 present.
- Step 24 absent.
- No synthetic users, attempts, answers, private scoring evidence, or temp
  helper remain.

## Recommendation

Keep the current state. It fixes the remaining repeat leak without making the
wrapper too expensive.

Do not add more wrapper-level share logic. If further dimension balancing is
needed, do it inside the ranker with precomputed per-attempt/per-user summaries,
not correlated subqueries in `get_next_assessment_question`.
