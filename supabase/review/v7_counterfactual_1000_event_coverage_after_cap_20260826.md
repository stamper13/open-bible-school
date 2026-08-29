# V7 Counterfactual 1000-Question Event Coverage Replay After Attempt Cap - 2026-08-26

## Purpose

Run a branch-only 1000-question V7 counterfactual replay to test whether the
router can sustain long-run novelty, broad-to-narrow ladder behavior, section
balance, and event coverage without getting stuck in one region or repeating
questions.

No production routing was changed. The live app-facing RPC chain remains V6:

`obs_start_or_resume_ot_assessment_v2 -> obs_get_next_ot_assessment_question -> obs_submit_ot_assessment_response_v2`

Branch: `v7-router-shadow-replay` (`goqgzeipwflwlfnymbaw`)

## Change Tested

This replay tested the branch after:

- `supabase/migrations/20260826172000_router_v7_supplemental_floor_and_attempt_cap.sql`
- `supabase/migrations/20260826183000_router_v7_attempt_section_cap_tuning.sql`

The second migration keeps V7 shadow-only and tunes the long-run section cap:

- starts the attempt-section cap after 150 long-run answers;
- applies when a section has at least 60 answered rows and exceeds its target
  share by more than the allowed margin;
- preserves true supplemental under-floor dimension recovery;
- increases the selected-row penalty to make the cap visible in long runs.

Branch verifier:

- `PASS: V7 attempt section cap tuning verifier completed under rollback`

## Replay Method

Profile: `ASYMMETRIC_SCRIPTURE_1000_EVENT_COVERAGE`

Shape: 20 attempts x 50 questions

Router mode: `V7_COUNTERFACTUAL_1000_EVENT_COVERAGE`

Method:

- create one synthetic branch-only authenticated anonymous user;
- start attempts through `obs_start_or_resume_ot_assessment_v2`;
- select the top V7 candidate directly from
  `obs_rank_ot_assessment_candidates_v7`;
- submit every selected question through
  `obs_submit_ot_assessment_response_v2`;
- record section, dimension, similarity key, lane, reason, depth, and parent
  evidence;
- compute metrics from the recorded rows;
- clean all synthetic rows and drop helper functions/tables.

The replay used the real scoring/submit path. It is intentionally slower than a
raw bank sample because it exercises the same assessment state the app relies
on.

## Headline Result

- Total rows: 1000
- Scored rows: 1000
- Distinct questions: 1000
- Exact repeat rows: 0
- Cross-attempt exact repeat rows: 0
- Similarity-cluster repeat rows: 0
- Unsupported order/drag rows: 0
- Overall simulated accuracy: 51.5%
- IDK rate: 15.9%

This is the strongest evidence so far that V7's exact-question and
similarity-key suppression are working under long-run pressure.

## Event Coverage

- `events_timeline` rows: 313/1000
- `events_timeline` rows with `event_id`: 214/313
- Distinct `events_timeline` event IDs touched: 184
- Distinct `events_timeline` event IDs available in the OT bank: 210
- `events_timeline` event coverage: 87.6%
- Distinct broad/mid `events_timeline` event IDs touched: 141
- Distinct broad/mid `events_timeline` event IDs available: 142
- Broad/mid `events_timeline` event coverage: 99.3%
- Distinct event IDs touched across all dimensions: 296
- Distinct event IDs available across the OT bank: 322
- Overall event-ID coverage: 91.9%

Event coverage by section:

| Section | Event rows | Distinct event IDs |
|---|---:|---:|
| Torah | 112 | 71 |
| Latter Prophets | 69 | 47 |
| Former Prophets | 80 | 44 |
| Writings | 52 | 22 |

Top event books:

| Book | Event rows | Distinct event IDs |
|---|---:|---:|
| GEN | 43 | 29 |
| EXO | 41 | 25 |
| 1SA | 19 | 11 |
| 2KI | 18 | 9 |
| NUM | 17 | 9 |
| EST | 12 | 9 |
| 1KI | 13 | 7 |
| DAN | 9 | 6 |
| ISA | 8 | 6 |
| JOS | 8 | 6 |

Assessment: event coverage is strong. The main caveat is that 99 of the 313
`events_timeline` rows did not carry an `event_id`, so event coverage would be
even more interpretable if more event/timeline questions were linked to event
metadata.

## Section Distribution

| Section | Served | Share | Accuracy |
|---|---:|---:|---:|
| Latter Prophets | 295 | 29.5% | 66.8% |
| Torah | 288 | 28.8% | 71.5% |
| Former Prophets | 228 | 22.8% | 28.9% |
| Writings | 189 | 18.9% | 24.3% |

Compared with the original 200-question V6 simulation:

| Metric | Original V6 200 | V7 1000 |
|---|---:|---:|
| Latter Prophets | 102/200, 51.0% | 295/1000, 29.5% |
| Former Prophets | 25/200, 12.5% | 228/1000, 22.8% |
| Writings | not a primary failure | 189/1000, 18.9% |
| Exact repeats | 7 cross-attempt | 0 |
| Similarity repeats | 10 cross-attempt | 0 |

The post-150 cap fired 279 times and visibly changed late-run shape. Latter
Prophets was heavily explored in the middle of the run, then faded in the last
300 questions while Torah, Former Prophets, Writings, and event coverage rose.

Progress by 100-question block:

| Questions | Latter | Events | Law | Post-150 cap | Low-evidence lane |
|---:|---:|---:|---:|---:|---:|
| 1-100 | 27 | 19 | 18 | 0 | 20 |
| 101-200 | 34 | 42 | 7 | 0 | 52 |
| 201-300 | 49 | 16 | 15 | 24 | 72 |
| 301-400 | 45 | 24 | 5 | 19 | 36 |
| 401-500 | 44 | 29 | 7 | 27 | 10 |
| 501-600 | 42 | 26 | 4 | 15 | 6 |
| 601-700 | 39 | 31 | 0 | 19 | 0 |
| 701-800 | 8 | 39 | 1 | 49 | 0 |
| 801-900 | 6 | 36 | 4 | 54 | 0 |
| 901-1000 | 1 | 51 | 1 | 72 | 0 |

## Dimension Distribution

| Dimension | Served | Share | Accuracy |
|---|---:|---:|---:|
| `events_timeline` | 313 | 31.3% | 61.3% |
| `theological_reasoning` | 232 | 23.2% | 52.6% |
| `promise_prophecy` | 165 | 16.5% | 73.9% |
| `characters_lineage` | 121 | 12.1% | 29.8% |
| `geography_nations` | 107 | 10.7% | 24.3% |
| `law_commands` | 62 | 6.2% | 27.4% |

`law_commands` is still the lowest-covered dimension over a very long replay.
It improved versus early V7 work, but it remains a bank/router coverage concern.

## Ladder Behavior

| Depth stage | Rows | Share |
|---:|---:|---:|
| 1 | 43 | 4.3% |
| 2 | 252 | 25.2% |
| 3 | 444 | 44.4% |
| 4 | 231 | 23.1% |
| 5 | 30 | 3.0% |

- Depth 4-5 rows: 261
- Parent-gated depth 4-5 rows: 261

Assessment: the ladder behavior is working. The router mostly asks broad/mid
questions, then narrows after parent evidence exists. It is not jumping straight
to chapter/local detail without evidence.

## Weak/Strong Drilldown

The replay did not behave randomly. It found broad section-level differences and
then exposed specific strong and weak pockets:

- Former Prophets stayed weak across dimensions, especially geography,
  theological reasoning, and characters.
- Writings stayed weak, especially theological reasoning and geography.
- Torah was broadly strong, but law, geography, and lineage were weak pockets.
- Latter Prophets prophecy/theology stayed strong, while geography and
  characters were weak pockets.

Section/dimension examples:

| Section | Dimension | Rows | Accuracy |
|---|---|---:|---:|
| Latter Prophets | `promise_prophecy` | 82 | 86.6% |
| Latter Prophets | `theological_reasoning` | 62 | 87.1% |
| Latter Prophets | `geography_nations` | 39 | 28.2% |
| Torah | `events_timeline` | 112 | 90.2% |
| Torah | `law_commands` | 44 | 22.7% |
| Former Prophets | `events_timeline` | 80 | 35.0% |
| Former Prophets | `geography_nations` | 30 | 20.0% |
| Writings | `theological_reasoning` | 84 | 16.7% |
| Writings | `events_timeline` | 52 | 34.6% |

Lowest-evidence books with at least 10 questions:

| Book | Rows | Accuracy |
|---|---:|---:|
| 2CH | 14 | 0.0% |
| 1CH | 16 | 6.3% |
| ECC | 16 | 12.5% |
| PRO | 15 | 13.3% |
| PSA | 25 | 16.0% |
| RUT | 18 | 16.7% |
| 2SA | 28 | 17.9% |

Strongest books with at least 10 questions:

| Book | Rows | Accuracy |
|---|---:|---:|
| EZE | 22 | 86.4% |
| OBA | 13 | 76.9% |
| DAN | 30 | 76.7% |
| DEU | 24 | 75.0% |
| MIC | 16 | 75.0% |
| NUM | 35 | 74.3% |
| EXO | 82 | 72.0% |
| GEN | 121 | 70.2% |

## Remaining Concern

Chapter-addressed prompts are still too common at 1000-question depth:

- Prompt-regex chapter-addressed rows: 220/1000
- Metadata `chapter_addressed_prompt` rows: 240/1000
- Metadata `exact_chapter_recall_required` rows: 0/1000
- Prompt rows using the word `chapter [number]`: 1/1000

This is better than blunt exact chapter recall, but still too high for the
learner experience. The likely cause is bank pressure: once V7 suppresses exact
and similarity repeats across a 1000-question history, it eventually has to use
more chapter-addressed but otherwise valid rows.

## Latency

The replay completed successfully, but late chunks took roughly 80-95 seconds
per 25 questions through MCP. That is acceptable for a one-off stress replay,
but it is too slow for repeated manual simulations. Before making V7 default,
we should either:

- keep activation limited to normal app sessions and run only small smoke tests;
- or add a purpose-built replay harness/perf path for large simulations.

The app-facing single-question path still needs a final smoke test after any
activation wrapper.

## Assessment

Working:

- scoring/crash safety through 1000 submitted rows;
- exact-question suppression;
- similarity-key suppression;
- long-run section cap;
- broad-to-narrow parent gating;
- event coverage;
- weak/strong drilldown by section, dimension, and book;
- no unsupported drag/order crash rows.

Still not default-ready without one more decision:

- chapter-addressed prompts are still too common in a 1000-question long run;
- `law_commands` remains comparatively under-covered;
- large synthetic replays are slow through the real RPC path.

## Recommendation

V7 looks ready for an app-facing opt-in smoke wrapper, not yet a silent default
replacement.

I would not keep tuning broad router philosophy right now. The major behavior is
finally in place: it is varied, evidence-seeking, broad-to-narrow, and much less
prophet-trapped than V6. The next launch-safe move should be:

1. Add an opt-in wrapper/feature flag that lets localhost or a controlled test
   user call V7 through the normal app path.
2. Tighten chapter-addressed demotion one more notch for V7, or flag/rewrite the
   top-used chapter-addressed rows rather than deleting them.
3. Run a human 20-question smoke test and a smaller 200-300 synthetic replay
   through the app-facing wrapper.
4. If no crash/regression appears, then decide whether V7 becomes default.

## Cleanup

The synthetic replay was fully cleaned:

- synthetic auth users remaining: 0;
- synthetic attempts remaining: 0;
- synthetic answers remaining: 0;
- helper functions remaining: 0;
- helper tables remaining: 0.
