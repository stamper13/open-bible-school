# V7 Coverage Diagnosis After Early Section Balance - 2026-08-26

## Purpose

Test whether the V7 shadow router, after the early section-balance patch, can
run a long 200-question counterfactual replay without becoming random,
repetitive, or trapped in one section/dimension.

The replay specifically checks whether V7 can:

- find low-evidence areas;
- probe weak regions enough to identify better/worse subareas;
- keep confirming strong regions without letting them dominate;
- preserve broad-to-narrow ladder behavior;
- avoid exact and similarity repeats;
- avoid chapter-addressed prompt concentration.

No production learner-facing routing was changed. The live app-facing RPC chain
remains the V6 path:

`obs_start_or_resume_ot_assessment_v2` ->
`obs_get_next_ot_assessment_question` ->
`obs_submit_ot_assessment_response_v2`

## Branch And Change Tested

Branch: `v7-router-shadow-replay` (`goqgzeipwflwlfnymbaw`)

Migration applied to the branch only:

- `supabase/migrations/20260826031552_router_v7_early_section_balance.sql`

Rollback and verifier:

- `supabase/rollback/20260826031552_router_v7_early_section_balance_rollback.sql`
- `supabase/verify/20260826031552_router_v7_early_section_balance_verify.sql`

The migration keeps V7 shadow-only. It adds an early attempt-level section brake
inside `obs_rank_ot_assessment_candidates_v7` when a non-weak-area lane has
already exceeded its expected early share. `WEAK_AREA_EVIDENCE` can still break
through the brake.

## Replay Method

Profile: `ASYMMETRIC_SCRIPTURE_200`

Shape: 4 attempts x 50 questions

Router mode: `V7_COUNTERFACTUAL_EARLY_SECTION_BALANCE`

Method:

- start a normal OT assessment attempt;
- select the top V7 counterfactual candidate directly;
- submit that selected question through
  `obs_submit_ot_assessment_response_v2`;
- repeat for 200 total questions;
- clean up synthetic users, attempts, answers, snapshots, and helper objects.

This is a better test than pure V7 shadow logs because counterfactual V7 picks
are actually answered and therefore become visible to V7's own history,
novelty, evidence, and share logic.

## Headline Result

- Total rows: 200
- Scored rows: 200
- Distinct questions: 200
- Within-attempt exact repeat rows: 0
- Cross-attempt exact repeat rows: 0
- Similarity-cluster repeat rows: 0
- Chapter-addressed rows: 9
- Exact chapter-recall rows: 0
- Depth 4-5 rows: 15
- Parent-gated narrow rows: 15
- Overall accuracy: 48.5%
- IDK rate: 19.0%
- OT display BLI: 283
- OT questions answered: 200
- OT correct answers: 97
- OT IDK answers: 38

Safety is clean: no scoring failures, no exact repeats, no similarity repeats,
and no exact chapter-recall rows.

## Distribution

### Section

| Section | Served | Accuracy | IDK | Books touched |
|---|---:|---:|---:|---:|
| Latter Prophets | 68 | 73.5% | 8.8% | 17 |
| Former Prophets | 50 | 22.0% | 32.0% | 7 |
| Torah | 47 | 61.7% | 10.6% | 5 |
| Writings | 35 | 20.0% | 31.4% | 10 |

### Dimension

| Dimension | Served | Accuracy | IDK |
|---|---:|---:|---:|
| `events_timeline` | 48 | 60.4% | 6.3% |
| `promise_prophecy` | 39 | 69.2% | 7.7% |
| `geography_nations` | 38 | 31.6% | 39.5% |
| `theological_reasoning` | 35 | 62.9% | 17.1% |
| `characters_lineage` | 25 | 16.0% | 40.0% |
| `law_commands` | 15 | 20.0% | 6.7% |

### Attempt Section Mix

| Attempt | Former | Latter | Torah | Writings |
|---|---:|---:|---:|---:|
| 1 | 11 | 19 | 10 | 10 |
| 2 | 15 | 15 | 13 | 7 |
| 3 | 8 | 21 | 11 | 10 |
| 4 | 16 | 13 | 13 | 8 |

The early section brake reduced the short-run Latter Prophets problem. Attempt
3 still reached 21/50 Latter items, but the 200-question total stayed at
68/200 instead of drifting toward the original 102/200 failure mode.

## Ladder Behavior

Depth distribution:

- Depth 1: 16
- Depth 2: 124
- Depth 3: 45
- Depth 4: 4
- Depth 5: 11

Parent gate distribution:

- Not narrow: 185
- Parent evidence present: 15

V7 did not jump into unsupported narrow detail. Every depth 4-5 question in
this replay had parent evidence present. The router is still conservative:
most of the run remained broad or mid-level, which is launch-safe but means V7
is not yet an aggressive deep-drill router.

Lane distribution:

- `BROAD_OPEN`: 25
- `BROAD_COVERAGE`: 42
- `WEAK_AREA_EVIDENCE`: 115
- `STRESS_TEST`: 11
- `WIDEN_AFTER_NARROW_MISS`: 7

This is not random routing. Most of the run was deliberately weak-area evidence,
with some broad coverage, some strong-area stress testing, and explicit widening
after narrow misses.

## Weak And Strong Diagnosis

Lowest-evidence remaining buckets:

- Section under 40 served: Writings, 35 served, 20.0% accuracy.
- Dimension under 20 served: `law_commands`, 15 served, 20.0% accuracy.

Worst section/dimension intersections with at least 3 served:

| Section | Dimension | Served | Accuracy | IDK |
|---|---|---:|---:|---:|
| Former Prophets | `promise_prophecy` | 6 | 0.0% | 33.3% |
| Writings | `characters_lineage` | 3 | 0.0% | 0.0% |
| Former Prophets | `characters_lineage` | 14 | 7.1% | 50.0% |
| Writings | `theological_reasoning` | 11 | 9.1% | 45.5% |
| Torah | `law_commands` | 9 | 11.1% | 11.1% |
| Former Prophets | `geography_nations` | 10 | 20.0% | 40.0% |
| Writings | `geography_nations` | 7 | 28.6% | 57.1% |
| Former Prophets | `events_timeline` | 15 | 33.3% | 13.3% |

Strongest confirmed intersections with at least 3 served:

| Section | Dimension | Served | Accuracy | IDK |
|---|---|---:|---:|---:|
| Torah | `events_timeline` | 13 | 92.3% | 0.0% |
| Latter Prophets | `theological_reasoning` | 11 | 90.9% | 0.0% |
| Torah | `theological_reasoning` | 10 | 90.0% | 0.0% |
| Latter Prophets | `events_timeline` | 9 | 88.9% | 0.0% |
| Latter Prophets | `promise_prophecy` | 26 | 88.5% | 0.0% |

Weakest books with at least 3 served:

- `1CH`: 6 served, 0.0% accuracy
- `2SA`: 5 served, 0.0% accuracy
- `JOS`: 10 served, 10.0% accuracy, 60.0% IDK
- `1KI`: 8 served, 12.5% accuracy
- `EZR`: 8 served, 12.5% accuracy
- `2KI`: 8 served, 25.0% accuracy
- `RUT`: 4 served, 25.0% accuracy, 75.0% IDK
- `NEH`: 6 served, 33.3% accuracy

Strongest books with at least 3 served:

- `DAN`: 3 served, 100.0% accuracy
- `HAG`: 3 served, 100.0% accuracy
- `ISA`: 6 served, 83.3% accuracy
- `JER`: 5 served, 80.0% accuracy
- `JOL`: 5 served, 80.0% accuracy
- `NAM`: 5 served, 80.0% accuracy
- `EXO`: 12 served, 75.0% accuracy

Worst units with at least 2 served:

- `jos-1-12`: 3 served, 0.0% accuracy, 100.0% IDK
- `1ki-1-19`: 2 served, 0.0% accuracy, 50.0% IDK
- `num-10-25`: 4 served, 25.0% accuracy
- `lev-17-27`: 3 served, 33.3% accuracy
- `exo-1-20`: 4 served, 50.0% accuracy
- `gen-12-50`: 2 served, 50.0% accuracy
- `rut-1-4`: 2 served, 50.0% accuracy, 50.0% IDK

## Comparison With Prior 200-Question Reports

| Metric | Original V6 2026-08-23 | Production V6 after hardening | V7 after perf cache | V7 after early balance |
|---|---:|---:|---:|---:|
| Scored rows | 200 | 200 | 200 | 200 |
| Distinct questions | 193 | 200 | 200 | 200 |
| Cross-attempt exact repeats | 7 | 0 | 0 | 0 |
| Similarity repeats | 10 | 0 | 0 | 0 |
| Chapter-addressed rows | 69 | 5 | 9 | 9 |
| Latter Prophets | 102 | 84 | 73 | 68 |
| Former Prophets | 25 | 42 | 43 | 50 |
| Torah | 36 | 42 | 45 | 47 |
| Writings | 37 | 32 | 39 | 35 |
| `promise_prophecy` | 55 | 55 | 46 | 39 |
| OT display BLI | n/a | 374 | 366 | 283 |

The early-balance V7 result is the best router-behavior result so far on
section/dimension concentration:

- Latter Prophets fell from 102 originally to 68.
- Former Prophets rose from 25 originally to 50.
- `promise_prophecy` fell from 55 to 39.
- Chapter-addressed rows stayed low at 9.
- Exact and similarity repeats stayed at 0.

The lower BLI is not a scoring change. It is a selection effect: V7 spent 115
questions in `WEAK_AREA_EVIDENCE`, found very weak Former Prophets/Writings
subareas, and produced lower section scores for those regions.

## Assessment

V7 is now much closer to the intended router philosophy.

Working:

- It does not crash or fail scoring in the 200-question replay.
- It suppresses exact and similarity repeats across attempts.
- It strongly avoids chapter-number recall without deleting usable rows.
- It no longer traps the learner in Latter Prophets / `promise_prophecy`.
- It finds weak regions and can name the worst subareas.
- It still checks strong regions through stress-test and broad-coverage lanes.
- It preserves broad-to-narrow behavior: narrow rows only appeared with parent
  evidence.

Remaining caution:

- Writings remained below the 40-question section evidence target at 35 served.
- `law_commands` remained below the 20-question dimension evidence target at 15
  served.
- The ladder is conservative. Depth 4-5 appeared only 15/200 times, which is
  safe but may not yet give enough deep-detail evidence for high-BLI learners.
- Attempt 3 still had a 21/50 Latter Prophets pocket, though the long-run total
  corrected by the end.
- The V7 counterfactual BLI was materially lower than the prior 200-question
  V6/V7 runs, so activation should include a manual smoke pass to confirm that
  the lower score feels diagnostically fair rather than overly punitive.

## Recommendation

Do not activate V7 for all learners yet, but the router behavior now looks
strong enough for the next gate.

Recommended next gate:

1. Add one more V7 shadow-only guardrail: a low-evidence floor for sections and
   dimensions late in a long run, so Writings and `law_commands` cannot remain
   under target when enough questions are available.
2. Run one internal/manual V7 activation smoke, ideally with a known test user,
   so the frontend experience and resulting BLI can be judged by feel.
3. If the smoke test feels fair, promote V7 to a very small internal cohort or
   keep it behind an explicit branch/test flag before production-wide rollout.

## Cleanup

Branch cleanup after the replay:

- temporary replay functions dropped;
- temporary replay tables dropped;
- matching synthetic auth users: 0;
- matching synthetic attempts: 0;
- matching synthetic answers: 0;
- matching synthetic snapshots: 0;
- recent orphan V7 shadow logs: 0.

## Verification

Branch:

- `20260826031552_router_v7_early_section_balance_verify.sql` passed under
  rollback after the 200-question replay.

Local:

- `npm --prefix web run test:backend-repo` passed.
- `node scripts/analyze-supabase-migration-chain.mjs --write` completed.
- `npm --prefix web run test:migration-chain` passed.
