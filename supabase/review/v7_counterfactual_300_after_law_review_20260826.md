# V7 Counterfactual 300-Question Replay After Law Review - 2026-08-26

## Purpose

Run a clean branch-only 300-question V7 replay after promoting 33 clean
broad/mid `law_commands` ladder metadata rows out of deterministic
`needs_review` demotion.

This was the next gate after:

- the long-run low-evidence floor;
- the late section-share brake;
- the focused V7 law metadata review.

No production routing was changed. The live app-facing RPC chain remains V6:

`obs_start_or_resume_ot_assessment_v2 -> obs_get_next_ot_assessment_question -> obs_submit_ot_assessment_response_v2`

Branch: `v7-router-shadow-replay` (`goqgzeipwflwlfnymbaw`)

## Replay Method

Profile: `ASYMMETRIC_SCRIPTURE_300_AFTER_LAW_REVIEW`

Shape: 6 attempts x 50 questions

Router mode: `V7_COUNTERFACTUAL_300_AFTER_LAW_REVIEW`

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

The final 50-question chunk initially hit an MCP HTTP 504 transport timeout.
State inspection showed no partial write: the run remained at 250/300 with no
recorded SQL error. The replay was resumed safely in two 25-question chunks.

## Headline Result

- Total rows: 300
- Scored rows: 300
- Distinct questions: 300
- Within-attempt exact repeat rows: 0
- Cross-attempt exact repeat rows: 0
- Similarity repeat rows: 0
- Unsupported order/drag rows: 0
- Chapter-addressed rows: 11
- Exact chapter-recall rows: 0
- Depth 4-5 rows: 20
- Parent-gated narrow rows: 20
- Overall simulated accuracy: 54.0%
- IDK rate: 13.3%

Safety and novelty remained excellent.

The temporary helper's BLI score capture still returned zeroed score JSON even
though 300 answer rows were scored. This remains a replay-helper issue, not a
routing result.

## Section Distribution

| Section | Served | Share | Accuracy | IDK | Books touched |
|---|---:|---:|---:|---:|---:|
| Latter Prophets | 104 | 34.7% | 74.0% | 8.7% | 17 |
| Torah | 76 | 25.3% | 67.1% | 10.5% | 5 |
| Former Prophets | 72 | 24.0% | 29.2% | 18.1% | 7 |
| Writings | 48 | 16.0% | 27.1% | 20.8% | 10 |

Compared with the previous 300-question replay after the long-run brake:

| Metric | Before law review | After law review |
|---|---:|---:|
| Latter Prophets share | 91/300, 30.3% | 104/300, 34.7% |
| Former Prophets share | 76/300, 25.3% | 72/300, 24.0% |
| Torah share | 76/300, 25.3% | 76/300, 25.3% |
| Writings share | 57/300, 19.0% | 48/300, 16.0% |

This is a regression in section balance. Latter Prophets is still below the old
500-question replay's 38.6%, but it rose materially from the immediately prior
300-question gate.

Attempt-level Latter Prophets counts:

- Attempt 1: 11/50
- Attempt 2: 16/50
- Attempt 3: 18/50
- Attempt 4: 20/50
- Attempt 5: 17/50
- Attempt 6: 22/50

The late section brake fired in the last 100 questions, but it did not prevent
Attempt 6 from reaching 22/50 Latter Prophets.

## Dimension Distribution

| Dimension | Served | Share | Accuracy | IDK |
|---|---:|---:|---:|---:|
| `events_timeline` | 65 | 21.7% | 60.0% | 15.4% |
| `theological_reasoning` | 64 | 21.3% | 71.9% | 4.7% |
| `promise_prophecy` | 62 | 20.7% | 80.6% | 3.2% |
| `geography_nations` | 49 | 16.3% | 22.4% | 22.4% |
| `characters_lineage` | 37 | 12.3% | 27.0% | 32.4% |
| `law_commands` | 23 | 7.7% | 26.1% | 8.7% |

`law_commands` improved only slightly:

| Metric | Before law review | After law review |
|---|---:|---:|
| `law_commands` | 21/300, 7.0% | 23/300, 7.7% |

The metadata promotion helped the available pool quality, but it did not solve
the routing coverage problem by itself.

## Lane Distribution

| Lane | Served |
|---|---:|
| `LOW_EVIDENCE_FLOOR` | 126 |
| `BROAD_COVERAGE` | 65 |
| `WEAK_AREA_EVIDENCE` | 51 |
| `BROAD_OPEN` | 39 |
| `STRESS_TEST` | 11 |
| `WIDEN_AFTER_NARROW_MISS` | 8 |

Progress by 100-question block:

| Through question | Low-evidence floor | Late section brake | Law | Latter |
|---:|---:|---:|---:|---:|
| 100 | 19 | 0 | 8 | 27 |
| 200 | 47 | 0 | 8 | 38 |
| 300 | 60 | 33 | 7 | 39 |

The floor remains active, but the last 100 questions still contained 39 Latter
Prophets and only 7 law-command rows.

## Ladder Behavior

Depth distribution:

- Depth 1: 22
- Depth 2: 136
- Depth 3: 122
- Depth 4: 4
- Depth 5: 16

All 20 depth 4-5 questions had parent evidence.

This continues to validate the broad-to-narrow ladder: V7 is not dropping into
details without parent evidence. The unresolved issue is coverage selection, not
ladder gating.

## Weak And Strong Diagnosis

Weakest books with at least 5 served:

- `JDG`: 9 served, 11.1% accuracy
- `JOB`: 7 served, 14.3% accuracy
- `1CH`: 6 served, 16.7% accuracy
- `EST`: 6 served, 16.7% accuracy
- `1SA`: 13 served, 23.1% accuracy
- `RUT`: 7 served, 28.6% accuracy

Strongest books with at least 5 served:

- `AMO`: 6 served, 100.0% accuracy
- `HAB`: 5 served, 100.0% accuracy
- `ISA`: 10 served, 90.0% accuracy
- `JON`: 6 served, 83.3% accuracy
- `MAL`: 6 served, 83.3% accuracy

Weakest intersections with at least 5 served:

- Torah / `law_commands`: 16 served, 12.5% accuracy
- Writings / `geography_nations`: 8 served, 12.5% accuracy
- Writings / `theological_reasoning`: 13 served, 15.4% accuracy
- Former Prophets / `theological_reasoning`: 6 served, 16.7% accuracy
- Latter Prophets / `geography_nations`: 16 served, 18.8% accuracy
- Former Prophets / `characters_lineage`: 15 served, 20.0% accuracy

The router is still diagnosing real weak points. The problem is that it is not
allocating enough volume to some of them, especially law and Writings, while it
continues to over-serve strong Latter prophecy/theology.

## Assessment

Working:

- crash/scoring safety;
- exact repeat suppression;
- similarity suppression;
- chapter-addressed demotion;
- exact chapter recall suppression;
- broad-to-narrow parent gating;
- weak/strong diagnosis.

Not working well enough for activation:

- law coverage barely moved after metadata review;
- Latter Prophets concentration regressed to 34.7%;
- Writings fell to 16.0%;
- the late section brake fires but is not strong enough when Latter remains
  attractive through strong prophecy/theology candidates.

## Recommendation

Do not activate V7 yet.

The next improvement should be a router-side coverage fix, not another metadata
review pass:

1. Add a V7-only low-evidence supplemental candidate source for clean broad/mid
   under-evidence dimensions, especially `law_commands`, instead of relying
   entirely on the widened V6 pool.
2. Strengthen the post-200 section cap so an over-target section cannot keep
   taking 17-22 questions in a 50-question attempt unless all under-evidence
   sections have no renderable candidates.
3. Re-run the same 300-question replay.

V7 should move to opt-in activation only after law rises materially and Latter
stays near the intended share across the final 100 questions.

## Cleanup

The synthetic replay was fully cleaned:

- synthetic auth users remaining: 0;
- synthetic attempts remaining: 0;
- synthetic answers remaining: 0;
- helper run rows remaining: 0;
- helper item rows remaining: 0;
- helper functions dropped;
- helper tables dropped.
