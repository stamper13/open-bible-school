# V7 Counterfactual 300-Question Replay After Long-Run Brake - 2026-08-26

## Purpose

Run the next branch-only gate after adding the extended low-evidence floor and
late section-share brake to V7.

This replay tests whether V7 can:

- avoid exact and similarity repeats;
- keep chapter-addressed prompts low;
- preserve broad-to-narrow ladder behavior;
- reduce Latter Prophets over-concentration;
- recover low-evidence sections and dimensions over a longer run.

No production routing was changed. The live app-facing RPC chain remains V6:

`obs_start_or_resume_ot_assessment_v2 -> obs_get_next_ot_assessment_question -> obs_submit_ot_assessment_response_v2`

Branch: `v7-router-shadow-replay` (`goqgzeipwflwlfnymbaw`)

## Replay Method

Profile: `ASYMMETRIC_SCRIPTURE_300_AFTER_LONG_RUN_BRAKE`

Shape: 6 attempts x 50 questions

Router mode: `V7_COUNTERFACTUAL_300_AFTER_LONG_RUN_BRAKE`

Method:

- create one synthetic branch-only authenticated anonymous user;
- start attempts through `obs_start_or_resume_ot_assessment_v2`;
- select the top V7 candidate directly from
  `obs_rank_ot_assessment_candidates_v7`;
- submit the selected question through
  `obs_submit_ot_assessment_response_v2`;
- record V7 lane/depth/reason metadata in temporary helper tables;
- compute metrics;
- clean all synthetic rows and drop helper functions/tables.

This makes V7 see its own selections as real answer history while preserving
the production V6 next-question RPC.

## Headline Result

- Total rows: 300
- Scored rows: 300
- Distinct questions: 300
- Within-attempt exact repeat rows: 0
- Cross-attempt exact repeat rows: 0
- Similarity repeat rows: 0
- Unsupported order/drag rows: 0
- Chapter-addressed rows: 13
- Exact chapter-recall rows: 0
- Depth 4-5 rows: 29
- Parent-gated narrow rows: 29
- Overall simulated accuracy: 47.0%
- IDK rate: 17.0%

Safety and novelty stayed excellent: every selected question scored, every
question was distinct, and no similarity repeat clusters appeared.

The temporary helper's BLI score capture still returned zeroed score JSON even
though 300 answer rows were scored. As with the 500-question replay, this report
uses answer-level routing metrics, not the helper BLI score snapshot.

## Section Distribution

| Section | Served | Share | Accuracy | IDK | Books touched |
|---|---:|---:|---:|---:|---:|
| Latter Prophets | 91 | 30.3% | 60.4% | 7.7% | 17 |
| Former Prophets | 76 | 25.3% | 26.3% | 22.4% | 7 |
| Torah | 76 | 25.3% | 68.4% | 14.5% | 5 |
| Writings | 57 | 19.0% | 24.6% | 28.1% | 10 |

This is a meaningful improvement over the prior 500-question replay:

| Metric | Prior 500 | New 300 |
|---|---:|---:|
| Latter Prophets share | 38.6% | 30.3% |
| Former Prophets share | 18.2% | 25.3% |
| Torah share | 24.0% | 25.3% |
| Writings share | 19.2% | 19.0% |

The late section brake appears to be doing its job. In the last 100 questions,
Latter Prophets dropped to 22/100, while Former Prophets rose to 33/100.

## Dimension Distribution

| Dimension | Served | Share | Accuracy | IDK |
|---|---:|---:|---:|---:|
| `events_timeline` | 64 | 21.3% | 53.1% | 17.2% |
| `promise_prophecy` | 60 | 20.0% | 68.3% | 6.7% |
| `geography_nations` | 56 | 18.7% | 33.9% | 30.4% |
| `theological_reasoning` | 52 | 17.3% | 61.5% | 7.7% |
| `characters_lineage` | 47 | 15.7% | 25.5% | 19.1% |
| `law_commands` | 21 | 7.0% | 14.3% | 28.6% |

`law_commands` remains the main unresolved problem. It stayed at exactly the
same share as the 500-question replay: 7.0%.

This supports the earlier pool diagnosis: V7 can select law candidates when
they are present, but the useful broad/mid law pool is thin and many law rows
are review-demoted or chapter-addressed.

## Lane Distribution

| Lane | Served |
|---|---:|
| `LOW_EVIDENCE_FLOOR` | 126 |
| `WEAK_AREA_EVIDENCE` | 53 |
| `BROAD_COVERAGE` | 52 |
| `BROAD_OPEN` | 36 |
| `STRESS_TEST` | 21 |
| `WIDEN_AFTER_NARROW_MISS` | 12 |

The extended low-evidence floor is no longer plateauing:

| Through question | Low-evidence floor | Late section brake | Law | Latter |
|---:|---:|---:|---:|---:|
| 100 | 19 | 0 | 7 | 30 |
| 200 | 44 | 0 | 8 | 39 |
| 300 | 63 | 35 | 6 | 22 |

The post-200 behavior is the important part: the late section brake fired 35
times in the last 100 questions, and Latter Prophets did not keep climbing.

## Ladder Behavior

Depth distribution:

- Depth 1: 22
- Depth 2: 140
- Depth 3: 109
- Depth 4: 8
- Depth 5: 21

All 29 depth 4-5 questions had parent evidence.

This is healthy broad-to-narrow behavior. V7 is not randomly throwing narrow
chapter/detail questions at the learner; it only descends when the parent area
has evidence.

## Weak And Strong Diagnosis

Weakest books with at least 5 served:

- `1KI`: 13 served, 7.7% accuracy
- `JDG`: 11 served, 9.1% accuracy
- `EST`: 10 served, 10.0% accuracy
- `EZR`: 10 served, 10.0% accuracy
- `JOB`: 9 served, 11.1% accuracy
- `2SA`: 10 served, 20.0% accuracy
- `RUT`: 9 served, 22.2% accuracy

Strongest books with at least 5 served:

- `NAM`: 6 served, 83.3% accuracy
- `PRO`: 5 served, 80.0% accuracy
- `ISA`: 9 served, 77.8% accuracy
- `DEU`: 13 served, 76.9% accuracy
- `EXO`: 18 served, 72.2% accuracy
- `DAN`: 7 served, 71.4% accuracy

Weakest section/dimension intersections with at least 5 served:

- Torah / `law_commands`: 13 served, 7.7% accuracy
- Writings / `geography_nations`: 8 served, 12.5% accuracy
- Former Prophets / `theological_reasoning`: 7 served, 14.3% accuracy
- Former Prophets / `events_timeline`: 15 served, 20.0% accuracy
- Former Prophets / `characters_lineage`: 18 served, 22.2% accuracy
- Latter Prophets / `characters_lineage`: 16 served, 25.0% accuracy

Strongest intersections with at least 5 served:

- Torah / `promise_prophecy`: 8 served, 100.0% accuracy
- Torah / `events_timeline`: 20 served, 95.0% accuracy
- Torah / `theological_reasoning`: 19 served, 94.7% accuracy
- Latter Prophets / `theological_reasoning`: 9 served, 88.9% accuracy
- Latter Prophets / `promise_prophecy`: 37 served, 81.1% accuracy

The router is not random. It found the intended weak profile clearly: Former
Prophets, Writings, geography, characters, and law all performed poorly, while
Torah event/theology and Latter prophecy/theology were strong.

## Assessment

Working:

- 300/300 scored;
- no exact repeats;
- no similarity repeats;
- no order/drag rows;
- chapter-addressed prompts stayed low;
- exact chapter recall stayed at zero;
- broad-to-narrow parent gating is working;
- late section brake materially improved Latter Prophets concentration;
- low-evidence floor stayed active after 200 answers.

Still not ready:

- `law_commands` stayed at 7.0%;
- the replay helper still cannot be used for displayed BLI comparisons;
- V7 has not yet been tested through an app-facing opt-in wrapper.

## Recommendation

V7 should not become the default live router yet.

The next best step is a targeted `law_commands` content/metadata pass, not a
broad router rewrite. The evidence points to a thin/noisy law candidate pool:
many law rows are review-demoted, chapter-addressed, or too narrow. After that,
run another 300-question replay. If law rises while section balance holds, V7
can move to an opt-in activation wrapper for live smoke testing.

## Cleanup

The synthetic replay was fully cleaned:

- synthetic auth users remaining: 0;
- synthetic attempts remaining: 0;
- synthetic answers remaining: 0;
- helper run rows remaining: 0;
- helper item rows remaining: 0;
- helper functions dropped;
- helper tables dropped.
