# V7 Branch Replay After Router Facts Cache - 2026-08-24

## Summary

Branch `v7-router-shadow-replay` (`goqgzeipwflwlfnymbaw`) now completes the
full asymmetric 200-question replay after adding the router question facts
performance cache.

No production schema or learner data was changed.

## New Backend Change

Added:

- `supabase/migrations/20260824202000_router_question_facts_perf_cache.sql`
- `supabase/rollback/20260824202000_router_question_facts_perf_cache_rollback.sql`
- `supabase/verify/20260824202000_router_question_facts_perf_cache_verify.sql`

The migration creates private `public.obs_router_question_facts`, populated from
the current question-bank view with the exact section and baseline-weight inputs
used by `obs_router_scope_baseline_met`. The helper now reads that narrow cached
table instead of expanding `obs_question_bank_with_dimensions` inside every
ranker call.

Behavior is intended to remain the same for the advanced-dimension baseline
gate; the change is only where the helper reads its question facts.

## Performance Result

Before the cache, branch timing probes showed:

- `obs_router_scope_baseline_met` after 150 prior answers: about 4.6 seconds.
- V6 ranker after 150 prior answers: about 7.8 seconds.
- 200-question replay: did not complete before timeout/cancellation.
- 80-question replay: also too slow to use as a gate.

After the cache:

- `obs_router_scope_baseline_met` after 150 prior answers: about 4.5 ms.
- V6 ranker after 150 prior answers: about 3.2 seconds.
- 200-question replay: completed successfully, roughly 11 minutes wall-clock on
  the remote branch.

Latency is much better, but still worth treating as a production caution. The
cache fixes the worst helper expansion, not every inherited V4/V5 ranker cost.

## Replay Result

Profile: `ASYMMETRIC_SCRIPTURE_200`

- Total answer rows: 200
- Scored rows: 200
- Distinct questions: 200
- Within-attempt exact repeats: 0
- Cross-attempt exact repeat rows: 0
- Similarity-cluster repeat rows: 0
- Unsupported order/drag response rows: 0
- High-specificity rows: 9
- Chapter-addressed rows: 9
- Overall simulated accuracy: 53.5%
- IDK rate: 14.0%

Scoring output:

- OT display BLI: 366
- OT accuracy: 53.5%
- OT answered: 200
- Correct: 107
- IDK: 28

Section scores:

- Latter Prophets: 554 display BLI, 76.7% accuracy, 73 answered
- Torah: 544 display BLI, 66.7% accuracy, 45 answered
- Writings: 72 display BLI, 30.8% accuracy, 39 answered
- Former Prophets: 58 display BLI, 20.9% accuracy, 43 answered

## Distribution Comparison

Previous 2026-08-23 report:

- Latter Prophets: 102/200
- Former Prophets: 25/200
- Torah: 36/200
- Writings: 37/200
- `promise_prophecy`: 55/200
- Chapter-addressed prompts: 69/200
- Cross-attempt exact repeat rows: 7
- Similarity-cluster repeat rows: 10

After branch changes:

- Latter Prophets: 73/200
- Former Prophets: 43/200
- Torah: 45/200
- Writings: 39/200
- `promise_prophecy`: 46/200
- Chapter-addressed prompts: 9/200
- Cross-attempt exact repeat rows: 0
- Similarity-cluster repeat rows: 0

The router is much closer to the stated philosophy:

- It still probes the simulated weak areas heavily.
- It no longer traps the learner in Latter Prophets / promise-prophecy.
- It avoids exact and similarity repeats across attempts in this replay.
- It strongly demotes chapter-addressed prompts without deleting usable content.

## Cleanup

Post-replay branch cleanup check:

- `auth.users`: 0
- `assessment_attempts`: 0
- `assessment_answers`: 0
- `private.bli_answer_scoring_evidence`: 0
- `obs_router_campaign`: 0
- `obs_router_v7_shadow_log`: 0
- temp simulation helper: absent

## Verification

Local:

- `npm --prefix web run test:backend-repo` passed.
- `npm --prefix web run test:migration-chain` passed.

Branch:

- `20260824202000_router_question_facts_perf_cache_verify.sql` passed.
- `20260824201000_router_v7_shadow_mode_verify.sql` passed after replay.

## Recommendation

This is now a credible non-production replay pass for the current V6 hardening
plus V7 shadow metadata/ranker work.

Do not activate V7 live routing yet. The app-facing RPC chain still executes
the hardened V6 path, while V7 remains shadow-only. The next gate should be a
deliberate V7 shadow replay/logging comparison or a production-like latency
budget decision for the remaining inherited V4/V5 ranker cost.
