# Production V7 Shadow + Router Facts Cache Rollout - 2026-08-25

## Scope

Applied launch-safe backend changes to production project `idyavsqksxtgogpfwlei`.

Production live routing remains V6:

- `active_version`: `V6`
- `shadow_version`: `V4`
- `campaign_enabled`: `true`

V7 was not activated for live routing. V7 objects are installed for shadow-only
use and future comparison.

## Applied To Production

- `20260823174000_question_ladder_metadata_schema.sql`
- `20260824190000_question_ladder_metadata_backfill.sql`
- `20260824200000_v7_question_ladder_metadata_review.sql`
- `20260824201000_router_v7_shadow_mode.sql`
- `20260824202000_router_question_facts_perf_cache.sql`

Production already had the V6 long-run hardening markers, and the V6 step 21
verifier passed before applying the missing V7/performance stack.

## Verification

Local gates passed before production apply:

- `npm --prefix web run test:backend-repo`
- `npm --prefix web run test:migration-chain`

Production SQL verifiers passed:

- V6 step 20 long-run brakes
- V6 step 21 widened campaign spend
- V6 step 22 next-question fallback
- V7 ladder metadata schema
- V7 metadata backfill
- V7 metadata review
- V7 shadow mode
- Router question facts performance cache

Production app-facing smoke passed:

`obs_start_or_resume_ot_assessment_v2 -> obs_get_next_ot_assessment_question -> obs_submit_ot_assessment_response_v2`

The smoke answered one real routed OT question with a synthetic user, forced
deferred scoring evidence capture, then removed the synthetic private evidence
and user rows.

## Production 200-Question Replay

Profile: `ASYMMETRIC_SCRIPTURE_200`

- Total answer rows: 200
- Scored rows: 200
- Distinct questions: 198
- Within-attempt exact repeats: 0
- Cross-attempt exact repeat rows: 2
- Similarity-cluster repeat rows: 2
- Unsupported order/drag response rows: 0
- High-specificity rows: 5
- Chapter-addressed rows: 5
- Overall simulated accuracy: 64.5%
- IDK rate: 12.5%

Section distribution:

- Latter Prophets: 78/200, 17 books, 85.9% accuracy
- Former Prophets: 45/200, 7 books, 46.7% accuracy
- Writings: 40/200, 10 books, 40.0% accuracy
- Torah: 37/200, 5 books, 67.6% accuracy

Dimension distribution:

- `promise_prophecy`: 56/200, 87.5% accuracy
- `events_timeline`: 44/200, 68.2% accuracy
- `theological_reasoning`: 37/200, 75.7% accuracy
- `characters_lineage`: 24/200, 33.3% accuracy
- `geography_nations`: 24/200, 41.7% accuracy
- `law_commands`: 15/200, 26.7% accuracy

Scoring output:

- OT display BLI: 456
- OT accuracy: 64.5%
- OT answered: 200
- Correct: 129
- IDK: 25

## Comparison Against 2026-08-23 Baseline

Baseline report:

- Latter Prophets: 102/200
- Former Prophets: 25/200
- Torah: 36/200
- Writings: 37/200
- `promise_prophecy`: 55/200
- Chapter-addressed prompts: 69/200
- Cross-attempt exact repeat rows: 7
- Similarity-cluster repeat rows: 10

Production after rollout:

- Latter Prophets: 78/200
- Former Prophets: 45/200
- Torah: 37/200
- Writings: 40/200
- `promise_prophecy`: 56/200
- Chapter-addressed prompts: 5/200
- Cross-attempt exact repeat rows: 2
- Similarity-cluster repeat rows: 2

The production replay shows clear improvement in section balance,
chapter-address demotion, and repeat suppression. It did not reproduce the
branch's perfect 0/0 exact/similarity repeat result; two residual cross-attempt
exact and similarity repeat rows remain.

## Cleanup

Post-smoke and post-replay production cleanup check:

- Recent synthetic anonymous auth users: 0
- Recent assessment attempts: 0
- Recent assessment answers: 0
- Recent private scoring evidence: 0
- Recent V7 shadow logs: 0
- temp simulation helper: absent

## Recommendation

Keep V7 shadow-only. Do not activate V7 live routing yet.

The rollout is launch-safe for the current live V6 path: the app-facing RPC
chain works, 200/200 synthetic questions scored, no unsupported order/drag rows
appeared, synthetic cleanup is clean, and chapter-addressed prompts dropped
sharply.

The next backend follow-up should target the remaining two exact/similarity
repeat leaks and the fact that `promise_prophecy` still reached 56/200 in the
production replay.
