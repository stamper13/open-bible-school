# V7 Counterfactual 300-Question Replay After Supplemental Floor/Cap - 2026-08-26

## Purpose

Run a branch-only 300-question replay after adding a V7 supplemental candidate
source for clean broad/mid low-evidence rows and strengthening the late
long-run section brake.

No production routing was changed. The live app-facing RPC chain remains V6:

`obs_start_or_resume_ot_assessment_v2 -> obs_get_next_ot_assessment_question -> obs_submit_ot_assessment_response_v2`

Branch: `v7-router-shadow-replay` (`goqgzeipwflwlfnymbaw`)

## Change Tested

Added and applied branch-only:

- `supabase/migrations/20260826172000_router_v7_supplemental_floor_and_attempt_cap.sql`
- `supabase/rollback/20260826172000_router_v7_supplemental_floor_and_attempt_cap_rollback.sql`
- `supabase/verify/20260826172000_router_v7_supplemental_floor_and_attempt_cap_verify.sql`

The migration keeps V7 shadow-only and:

- adds `V7_LOW_EVIDENCE_SUPPLEMENTAL`, a clean broad/mid supplemental source
  outside the widened V6 pool;
- restricts supplemental rows to depth 1-3, renderable MCQ payloads,
  non-chapter-addressed prompts, non-exact-chapter-recall rows, and reviewed or
  accepted metadata;
- excludes exact-history and similarity-history repeats;
- strengthens the late long-run section brake from penalty `3` to `5`;
- adds a post-200 attempt-section cap, though this replay showed that cap did
  not actually fire under the tested profile.

Branch verifier:

- `PASS: V7 supplemental floor/cap verifier completed under rollback`

## Replay Method

Profile: `ASYMMETRIC_SCRIPTURE_300_AFTER_SUPPLEMENTAL_CAP`

Shape: 6 attempts x 50 questions

Router mode: `V7_COUNTERFACTUAL_300_AFTER_SUPPLEMENTAL_CAP`

Method:

- create one synthetic branch-only authenticated anonymous user;
- start attempts through `obs_start_or_resume_ot_assessment_v2`;
- select the top V7 candidate directly from
  `obs_rank_ot_assessment_candidates_v7`;
- submit the selected question through
  `obs_submit_ot_assessment_response_v2`;
- record V7 lane/reason/depth and whether the row came from the supplemental
  source;
- compute metrics;
- clean all synthetic rows and drop helper functions/tables.

The fourth 50-question chunk hit an MCP HTTP 504 transport timeout. State
inspection showed no partial write and no SQL error. The run was resumed safely
in 25-question chunks.

## Headline Result

- Total rows: 300
- Scored rows: 300
- Distinct questions: 300
- Within-attempt exact repeat rows: 0
- Cross-attempt exact repeat rows: 0
- Similarity repeat rows: 0
- Unsupported order/drag rows: 0
- Chapter-addressed rows: 8
- Exact chapter-recall rows: 0
- Depth 4-5 rows: 17
- Parent-gated narrow rows: 17
- Overall simulated accuracy: 48.0%
- IDK rate: 16.0%

Safety and novelty remained excellent.

## Section Distribution

| Section | Served | Share | Accuracy | IDK | Books touched |
|---|---:|---:|---:|---:|---:|
| Latter Prophets | 97 | 32.3% | 66.0% | 9.3% | 17 |
| Torah | 79 | 26.3% | 55.7% | 16.5% | 5 |
| Former Prophets | 76 | 25.3% | 31.6% | 19.7% | 7 |
| Writings | 48 | 16.0% | 25.0% | 22.9% | 10 |

Compared with the previous after-law-review replay:

| Metric | After law review | After supplemental source |
|---|---:|---:|
| Latter Prophets | 104/300, 34.7% | 97/300, 32.3% |
| Torah | 76/300, 25.3% | 79/300, 26.3% |
| Former Prophets | 72/300, 24.0% | 76/300, 25.3% |
| Writings | 48/300, 16.0% | 48/300, 16.0% |

This improved Latter Prophets somewhat, but did not fully solve attempt-level
spikes:

- Attempt 4: 22/50 Latter
- Attempt 5: 19/50 Latter
- Attempt 6: 17/50 Latter

The post-200 attempt-section cap recorded 0 selected rows. That means the
current condition is too conservative or the selected over-concentration is
still being protected by `LOW_EVIDENCE_FLOOR`.

## Dimension Distribution

| Dimension | Served | Share | Accuracy | IDK | Supplemental |
|---|---:|---:|---:|---:|---:|
| `events_timeline` | 74 | 24.7% | 51.4% | 13.5% | 37 |
| `geography_nations` | 69 | 23.0% | 34.8% | 23.2% | 42 |
| `promise_prophecy` | 47 | 15.7% | 72.3% | 4.3% | 2 |
| `law_commands` | 40 | 13.3% | 35.0% | 27.5% | 27 |
| `theological_reasoning` | 36 | 12.0% | 55.6% | 5.6% | 0 |
| `characters_lineage` | 34 | 11.3% | 41.2% | 20.6% | 3 |

This is the first strong evidence that the supplemental source solved the law
coverage bottleneck:

| Metric | After law review | After supplemental source |
|---|---:|---:|
| `law_commands` | 23/300, 7.7% | 40/300, 13.3% |
| supplemental law rows | n/a | 27 |

Law is still under the nominal 50-question long-run dimension floor at 300, but
it improved materially and is now being actively recovered.

## Lane Distribution

| Lane | Served |
|---|---:|
| `LOW_EVIDENCE_FLOOR` | 151 |
| `WEAK_AREA_EVIDENCE` | 61 |
| `BROAD_OPEN` | 42 |
| `BROAD_COVERAGE` | 26 |
| `STRESS_TEST` | 15 |
| `WIDEN_AFTER_NARROW_MISS` | 5 |

Progress by 100-question block:

| Through question | Low-evidence floor | Supplemental | Law | Latter | Late section brake | Post-200 cap |
|---:|---:|---:|---:|---:|---:|---:|
| 100 | 20 | 20 | 17 | 28 | 0 | 0 |
| 200 | 58 | 54 | 8 | 33 | 0 | 0 |
| 300 | 73 | 37 | 15 | 36 | 36 | 0 |

The supplemental source did exactly what it was supposed to do. The post-200
attempt cap did not.

## Assessment

Working:

- scoring/crash safety;
- exact repeat suppression;
- similarity suppression;
- chapter-addressed demotion;
- exact chapter recall suppression;
- broad-to-narrow parent gating;
- low-evidence supplemental source;
- law recovery;
- Latter Prophets improved versus the previous replay.

Still not ready:

- Writings remains low at 16.0%;
- Latter Prophets still spikes inside individual attempts;
- the post-200 attempt-section cap did not fire;
- V7 is not yet tested through an app-facing opt-in wrapper;
- the replay helper still is not suitable for displayed BLI comparison.

## Recommendation

Do not activate V7 as the default router yet.

The supplemental source is a keeper: it raised `law_commands` from 23/300 to
40/300 without repeats or chapter-recall regression.

The next small router patch should focus only on section shape:

- make the post-200 attempt-section cap less conservative, or start it after
  150 long-run answers;
- cap an in-attempt section once it exceeds roughly 16/50 unless the selected
  row is from a truly under-floor dimension or no under-evidence alternatives
  exist;
- preserve the low-evidence supplemental source as-is.

After that, rerun the same 300-question replay. If law stays near or above
40/300 and Latter drops closer to 85-90/300 without starving weak sections, V7
can move to an opt-in wrapper smoke test.

## Cleanup

The synthetic replay was fully cleaned:

- synthetic auth users remaining: 0;
- synthetic attempts remaining: 0;
- synthetic answers remaining: 0;
- helper run rows remaining: 0;
- helper item rows remaining: 0;
- helper functions dropped;
- helper tables dropped.
