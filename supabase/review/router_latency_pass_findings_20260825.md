# Router Latency Pass Findings - 2026-08-25

## Scope

Latency pass on the OT assessment router after production step 23
cross-attempt repeat hardening.

No production changes were applied during this pass.

## Branch

- Branch project: `goqgzeipwflwlfnymbaw`
- Branch name: `v7-router-shadow-replay`
- Production project remains on the step 23 router state.

## Local Health

Before branch work:

- `npm --prefix web run test:backend-repo` passed.
- `node scripts/analyze-supabase-migration-chain.mjs --write` passed.
- `npm --prefix web run test:migration-chain` passed.

## Tested Branch-Only Ideas

Three narrow latency ideas were tested on the branch and then rolled back:

1. Cache wrapper similarity keys in `obs_router_question_facts`.
2. Collapse strict-plus-relaxed wrapper novelty selection into one ranker call.
3. Move selected V6 ranker answer-history CTEs onto `obs_router_question_facts`.

These changes were not production-worthy. They did not materially improve the
150-prior-answer synthetic hot path.

## Timings

Synthetic shape:

- 1 synthetic anonymous auth user.
- 1 current OT adaptive attempt.
- 1 prior OT adaptive attempt.
- 150 prior scoring-eligible answers.
- Synthetic data deleted immediately after each probe.

Measured branch timings:

| State | Probe | Time |
| --- | ---: | ---: |
| After wrapper similarity cache | `get_next_assessment_question` | 2896.81 ms |
| After single-pass wrapper fallback | `get_next_assessment_question` | 2873.86 ms |
| After cached V6 history | `obs_rank_ot_assessment_candidates_v6` | 2760.35 ms |
| After cached V6 history | `get_next_assessment_question` | 2914.78 ms |
| After rollback to step 23 | `obs_rank_ot_assessment_candidates_v4` | 1934.22 ms |
| After rollback to step 23 | `obs_rank_ot_assessment_candidates_v5` | 1951.95 ms |
| After rollback to step 23 | `get_next_assessment_question` | 3057.65 ms |

Earlier baseline noted before this pass:

- Production `get_next_assessment_question` after 150 prior answers: about 1004 ms.
- Branch `get_next_assessment_question` after 150 prior answers: about 1239 ms.

The later branch probe selected a case where wrapper fallback/reranking was
more expensive, but the important finding held: V4/V5 are the latency floor.

## Findings

- The wrapper-level step 23 repeat gate is not the main remaining bottleneck.
- V6 delegates to V5; V5 delegates to V4.
- In the tested synthetic shape, V4 and V5 each took about 1.9 seconds even
  before V6-specific reranking.
- Small V6 wrapper/history patches do not move the end-to-end latency enough to
  justify production rollout.
- The next real latency target is the V4/V5 base candidate path, especially
  repeated candidate-bank derivation and per-candidate helper calls.

## Cleanup

Branch cleanup after rollback:

- Step 23 marker present.
- Experimental cache/single-pass/cached-history markers absent.
- Recent synthetic auth users: 0.
- Recent synthetic attempts: 0.

## Recommended Next Step

Do not ship a small wrapper latency patch.

For a meaningful latency improvement, design a branch-only candidate-facts cache
for the V4/V5 base selector. The cache should precompute stable question-bank
facts used by raw candidate creation, such as prompt, question type, book,
dimension, question family, stem family, effective IRT values, focused item
stage, information reliability, importance score, choice validity, and section.

Only after that cache improves branch `obs_rank_ot_assessment_candidates_v4`,
`obs_rank_ot_assessment_candidates_v5`, and app-wrapper `get_next` timings
should it be considered for production.
