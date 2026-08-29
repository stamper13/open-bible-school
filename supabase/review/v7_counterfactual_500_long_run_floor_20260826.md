# V7 Counterfactual 500-Question Replay - 2026-08-26

## Purpose

Run a long 500-question V7 counterfactual assessment on the Supabase branch to
stress-test:

- repeat suppression;
- similarity suppression;
- broad-to-narrow ladder behavior;
- section and dimension concentration;
- low-evidence area recovery;
- whether the router can keep diagnosing weak/strong subareas over many
  attempts without getting stuck.

No production routing was changed.

Branch: `v7-router-shadow-replay` (`goqgzeipwflwlfnymbaw`)

## Important Fix Found During The Run

The first replay attempt exposed a bug in the new late low-evidence floor:

- `LOW_EVIDENCE_FLOOR` never fired in normal 50-question attempts.
- Cause: the threshold checked current-attempt answer count
  (`answer_totals >= 80`) instead of learner long-run answer count.
- Since each attempt is 50 questions, the threshold was unreachable.

Added and applied branch-only:

- `supabase/migrations/20260826140228_router_v7_low_evidence_floor_long_run_total.sql`
- `supabase/rollback/20260826140228_router_v7_low_evidence_floor_long_run_total_rollback.sql`
- `supabase/verify/20260826140228_router_v7_low_evidence_floor_long_run_total_verify.sql`

The verifier passed under rollback. The clean 500-question replay below was
run after this fix.

## Replay Method

Profile: `ASYMMETRIC_SCRIPTURE_500_LONG_RUN_FLOOR`

Shape: 10 attempts x 50 questions

Router mode: `V7_COUNTERFACTUAL_500_WITH_LOW_EVIDENCE_FLOOR`

Method:

- create a synthetic branch-only authenticated anonymous user;
- start normal OT attempts through `obs_start_or_resume_ot_assessment_v2`;
- select V7's top counterfactual candidate directly;
- submit that selected question through `obs_submit_ot_assessment_response_v2`;
- record route metadata in temporary helper tables;
- finish and clean all synthetic rows;
- drop helper functions/tables.

This makes V7 see its own selected questions as history.

## Headline Result

- Total rows: 500
- Scored rows: 500
- Distinct questions: 500
- Within-attempt exact repeat rows: 0
- Cross-attempt exact repeat rows: 0
- Similarity repeat rows: 0
- Chapter-addressed rows: 23
- Exact chapter-recall rows: 0
- Depth 4-5 rows: 40
- Parent-gated narrow rows: 40
- Overall simulated accuracy: 55.6%
- IDK rate: 12.8%

Safety result is excellent: 500 scored, 500 distinct, no exact repeats, no
similarity repeats, no exact chapter-recall rows.

The BLI score JSON returned zeros from this temporary replay helper despite
500 scored answer rows, so this report treats answer-level and routing metrics
as valid but does not use the helper's displayed BLI output. That scoring
snapshot issue should be inspected separately before using this helper for BLI
comparison.

## Section Distribution

| Section | Served | Share | Accuracy | IDK | Books touched |
|---|---:|---:|---:|---:|---:|
| Latter Prophets | 193 | 38.6% | 72.0% | 7.8% | 17 |
| Torah | 120 | 24.0% | 65.0% | 9.2% | 5 |
| Writings | 96 | 19.2% | 40.6% | 15.6% | 10 |
| Former Prophets | 91 | 18.2% | 24.2% | 25.3% | 7 |

Every section cleared the 80-question long-run floor. This is a major
improvement over the earlier 200-question run where Writings stayed at 35.

However, Latter Prophets still over-concentrated late in the run. It reached
193/500, including several attempt-level pockets:

- Attempt 4: 22/50 Latter
- Attempt 5: 22/50 Latter
- Attempt 6: 27/50 Latter
- Attempt 7: 27/50 Latter
- Attempt 10: 21/50 Latter

## Dimension Distribution

| Dimension | Served | Accuracy | IDK |
|---|---:|---:|---:|
| `events_timeline` | 130 | 66.9% | 8.5% |
| `theological_reasoning` | 101 | 69.3% | 8.9% |
| `promise_prophecy` | 92 | 76.1% | 5.4% |
| `geography_nations` | 76 | 28.9% | 23.7% |
| `characters_lineage` | 66 | 28.8% | 21.2% |
| `law_commands` | 35 | 28.6% | 20.0% |

`law_commands` remained under the 50-question diagnostic floor. This is the
main unresolved coverage problem from the 500-question run.

## Lane Distribution

- `BROAD_COVERAGE`: 180
- `WEAK_AREA_EVIDENCE`: 149
- `LOW_EVIDENCE_FLOOR`: 67
- `BROAD_OPEN`: 58
- `STRESS_TEST`: 34
- `WIDEN_AFTER_NARROW_MISS`: 12

The long-run floor fired after the fix and helped sections recover early:

- At 100: `LOW_EVIDENCE_FLOOR` had fired 18 times.
- At 200: it had fired 63 times.
- At 300: it had fired 67 times.
- At 400 and 500: it remained 67.

That plateau matters. It suggests either:

- the widened V6 pool stopped surfacing enough low-evidence candidates, or
- the low-evidence floor's sort boost is not strong enough once broad coverage
  and other V7 priorities dominate.

## Ladder Behavior

Depth distribution:

- Depth 1: 33
- Depth 2: 203
- Depth 3: 224
- Depth 4: 13
- Depth 5: 27

Parent gate:

- Not narrow: 460
- Parent evidence present: 40

This is healthy broad-to-narrow behavior. V7 did reach deeper detail more often
than the 200-question run, but every depth 4-5 item had parent evidence.

The router is still conservative: 460/500 questions were not narrow, and
depth 4-5 was only 8% of the run.

## Weak And Strong Diagnosis

Weakest books with at least 5 served:

- `1SA`: 13 served, 0.0% accuracy
- `RUT`: 7 served, 14.3% accuracy, 57.1% IDK
- `2SA`: 13 served, 23.1% accuracy
- `EST`: 12 served, 25.0% accuracy
- `1KI`: 15 served, 26.7% accuracy
- `JDG`: 11 served, 27.3% accuracy
- `JOS`: 14 served, 28.6% accuracy
- `SNG`: 10 served, 30.0% accuracy
- `ECC`: 10 served, 30.0% accuracy

Strongest books with at least 5 served:

- `LAM`: 13 served, 92.3% accuracy
- `HAG`: 9 served, 88.9% accuracy
- `JON`: 11 served, 81.8% accuracy
- `DAN`: 21 served, 81.0% accuracy
- `MIC`: 9 served, 77.8% accuracy
- `HOS`: 9 served, 77.8% accuracy
- `NUM`: 25 served, 76.0% accuracy

Weakest section/dimension intersections with at least 5 served:

- Torah / `characters_lineage`: 5 served, 0.0% accuracy
- Former / `promise_prophecy`: 17 served, 17.6% accuracy
- Former / `geography_nations`: 19 served, 21.1% accuracy
- Torah / `geography_nations`: 13 served, 23.1% accuracy
- Latter / `characters_lineage`: 25 served, 24.0% accuracy
- Former / `characters_lineage`: 24 served, 25.0% accuracy
- Latter / `geography_nations`: 28 served, 25.0% accuracy

Strongest section/dimension intersections with at least 5 served:

- Latter / `theological_reasoning`: 35 served, 100.0% accuracy
- Latter / `promise_prophecy`: 56 served, 94.6% accuracy
- Torah / `events_timeline`: 33 served, 90.9% accuracy
- Torah / `theological_reasoning`: 26 served, 88.5% accuracy
- Latter / `events_timeline`: 46 served, 82.6% accuracy

This is not random. V7 is identifying clear weak and strong subregions. The
quality issue is concentration, not lack of diagnostic signal.

## Comparison To Prior 200-Question V7

| Metric | V7 200 after early balance | V7 500 with long-run floor |
|---|---:|---:|
| Scored rows | 200 | 500 |
| Distinct questions | 200 | 500 |
| Cross-attempt exact repeats | 0 | 0 |
| Similarity repeats | 0 | 0 |
| Chapter-addressed rows | 9 | 23 |
| Depth 4-5 rows | 15 | 40 |
| Latter Prophets share | 68/200, 34.0% | 193/500, 38.6% |
| Former Prophets share | 50/200, 25.0% | 91/500, 18.2% |
| Torah share | 47/200, 23.5% | 120/500, 24.0% |
| Writings share | 35/200, 17.5% | 96/500, 19.2% |
| `law_commands` | 15/200, 7.5% | 35/500, 7.0% |

The section low-evidence floor helped Writings clear a reasonable long-run
evidence threshold. It did not solve `law_commands`, and it did not prevent
late Latter Prophets concentration.

## Assessment

Working:

- crash/scoring-row safety;
- exact repeat suppression;
- similarity repeat suppression;
- chapter recall demotion;
- parent-gated ladder descent;
- real weak/strong diagnosis;
- section low-evidence recovery.

Not yet working well enough:

- long-run Latter Prophets concentration;
- `law_commands` evidence recovery;
- late low-evidence floor persistence after about 300 questions;
- helper BLI score capture for synthetic replay reporting.

## Recommendation

Do not activate V7 broadly yet.

Next backend work should be narrow:

1. Inspect whether `law_commands` candidates are present in the widened V6 pool
   after 300+ answers. If they are absent, V7 cannot select them and the pool
   needs widening or a low-evidence candidate source outside the V6 top 200.
2. Strengthen long-run section share brakes for Latter Prophets after 200+
   answers, especially when the section is already above target and weak
   sections still have useful candidates.
3. Fix the temporary replay helper's BLI score capture before using 500-question
   replays to compare displayed BLI.
4. Re-run a shorter 300-question replay after those two routing fixes; 500 was
   useful, but 300 is enough to expose the late-floor plateau and Latter pocket.

## Cleanup

Cleanup audit after the replay:

- helper start function dropped;
- helper step function dropped;
- helper finish function dropped;
- helper run table dropped;
- helper item table dropped;
- matching synthetic auth users: 0;
- recent orphan attempts: 0;
- recent orphan answers: 0.

## Verification

Local checks after adding the long-run floor fix:

- `npm --prefix web run test:backend-repo` passed.
- `node scripts/analyze-supabase-migration-chain.mjs --write` completed.
- `npm --prefix web run test:migration-chain` passed.

Branch:

- `20260826140228_router_v7_low_evidence_floor_long_run_total_verify.sql`
  passed under rollback.
