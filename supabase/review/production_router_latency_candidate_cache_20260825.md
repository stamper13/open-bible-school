# Production Router Latency Candidate Cache - 2026-08-25

## Goal

Improve OT assessment router latency without changing scoring, activating V7,
or breaking the app-facing RPC chain:

- `obs_start_or_resume_ot_assessment_v2`
- `obs_get_next_ot_assessment_question`
- `obs_submit_ot_assessment_response_v2`

## Research Summary

The prior latency pass showed wrapper-level edits were not enough. V6 delegates
to V5, and V5 delegates to V4, so the V4 base selector was the real floor.

Top five latency levers identified:

1. Cache stable V4/V5 candidate facts so the ranker does not repeatedly expand
   question-bank views and recompute stable helper outputs.
2. Add targeted indexes only where hot queries prove missing access paths.
3. Replace per-candidate `times_answered` lateral counts with grouped user
   history joins.
4. Precompute question validity, effective IRT values, stage, reliability,
   family keys, and unit/stage facts.
5. Keep a repeatable latency/replay verifier so improvements are measured
   against the full app RPC path, not just one helper.

Implemented items 1 and 4.

## Production Migrations Applied

- `20260825210000_router_v4_candidate_facts_cache.sql`
- `20260825211000_router_foundation_gap_cached_unit_stage.sql`

Both include rollback and verify files.

## What Changed

Added private cache:

- `public.obs_router_candidate_facts`
- `public.obs_refresh_router_candidate_facts()`

Cached facts include:

- prompt/payload/book/dimension/family fields
- effective IRT `a` and `b`
- focused item stage
- information reliability
- question validity flags
- section and unit mapping

Updated:

- `obs_rank_ot_assessment_candidates_v4` now reads stable candidate facts from
  `obs_router_candidate_facts`.
- `get_next_assessment_question` dashboard foundation-gap guard now checks
  cached `unit_key` + `candidate_stage = 1` rows instead of expanding
  `obs_question_bank_with_units` and recomputing stage.

## Branch Validation

Branch project: `goqgzeipwflwlfnymbaw`

Candidate cache branch timings after 150 prior answers:

| Probe | Time |
| --- | ---: |
| V4 ranker | 929.58 ms |
| V5 ranker | 938.91 ms |
| V6 ranker | 1636.83 ms |
| `get_next_assessment_question` | 2003.01 ms |

Branch old-vs-new V4 behavioral equivalence:

- Same synthetic learner/attempt.
- Old V4 backup vs cached V4 returned 0 differing questions across top 25.

## Production Validation

Production old-vs-new V4 timing, same synthetic shape:

| Probe | Run 1 | Run 2 | Run 3 |
| --- | ---: | ---: | ---: |
| Old V4 backup | 1795.82 ms | 1711.98 ms | 1637.67 ms |
| Cached V4 | 746.16 ms | 878.44 ms | 739.52 ms |
| App `get_next` after cache | 1791.58 ms | 2222.66 ms | 1558.89 ms |

The cache roughly halves V4 latency. App `get_next` is improved but still has
meaningful V6/wrapper overhead to address later.

## 200-Question Replay

Production replay completed through the app-facing RPC chain.

Key results:

- Total rows: 200
- Scored rows: 200
- Distinct questions: 200
- Within-attempt exact repeats: 0
- Cross-attempt exact repeats: 0
- Similarity-cluster repeats: 0
- Unsupported drag/order rows: 0
- Chapter-addressed rows: 5
- High-specificity rows: 5

Distribution:

- Latter Prophets: 84
- Former Prophets: 42
- Torah: 42
- Writings: 32

Top dimensions:

- `promise_prophecy`: 55
- `events_timeline`: 48
- `characters_lineage`: 27
- `geography_nations`: 26
- `theological_reasoning`: 26
- `law_commands`: 18

## Production State

Post-rollout audit:

- Active router version: `V6`
- V4 candidate cache marker present.
- Cached foundation-gap marker present.
- Candidate fact rows: 1,488
- Valid candidate fact rows: 1,488
- Cached unit stage-1 rows: 106
- Recent synthetic auth users: 0
- Recent synthetic attempts: 0
- Recent synthetic answers: 0
- Replay helper present: false

## Remaining Latency Work

The next high-value latency target is V6/wrapper overhead above cached V4:

- V6 still adds reranking and repeat/share/foundation logic around V5.
- Step 23 wrapper similarity suppression still has old view-based similarity
  checks in some paths.
- Per-candidate `times_answered` lateral counts in V5/V6 supplemental lanes
  are likely the next safe optimization area.
