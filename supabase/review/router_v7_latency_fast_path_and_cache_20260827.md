# Router V7 Latency Pass - Fast Path and Candidate Facts Cache

Date: 2026-08-27

## Goal

Make active OT V7 next-question loading faster without changing scoring, question
quality rules, the app-facing RPC chain, or learner-facing router philosophy.

RPC chain preserved:

- `obs_start_or_resume_ot_assessment_v2`
- `obs_get_next_ot_assessment_question`
- `obs_submit_ot_assessment_response_v2`

## Findings

The frontend already prefetches the next question during the feedback screen,
after the current answer has been submitted. It cannot safely choose the next
adaptive question while the learner is still answering, because the next route
depends on the just-submitted evidence.

Production baseline probes before this pass:

| Probe | Before |
|---|---:|
| Direct `obs_rank_ot_assessment_candidates_v7` | ~2271 ms |
| App-facing `obs_get_next_ot_assessment_question` | ~1905 ms |

The active V7 path still expanded `obs_question_bank_with_dimensions` in several
history/repeat/balance checks even though `obs_router_candidate_facts` already
contains the same stable question facts.

The initial section-balance wrapper also used repeated correlated section counts
inside the candidate order clause. V7 ranker output already includes each
candidate's `v7_attempt_section_share`, so recounting was unnecessary.

## Options Considered

1. Frontend precompute while the user answers: rejected for now. Adaptive choice
   depends on the submitted answer, so this would either be stale or require
   speculative routes.
2. Broaden frontend prefetch after submit: useful UX polish, but it does not
   reduce database execution time.
3. Use V7 ranker section-share output for early balance: implemented. This keeps
   the initial anti-hyperfixation behavior while removing correlated recounts.
4. Replace heavy question-bank view reads with `obs_router_candidate_facts`:
   implemented. This preserves routing behavior and removes repeated view
   expansion.
5. Precompute a `similarity_key` cache column: good next step if needed. It would
   avoid repeated calls to `obs_assessment_question_similarity_key`, but it is a
   broader cache/refresh change than this pass.

## Implemented

Added:

- `supabase/migrations/20260827115000_router_v7_initial_section_balance_fast_path.sql`
- `supabase/rollback/20260827115000_router_v7_initial_section_balance_fast_path_rollback.sql`
- `supabase/verify/20260827115000_router_v7_initial_section_balance_fast_path_verify.sql`
- `supabase/migrations/20260827116000_router_v7_use_candidate_facts_cache.sql`
- `supabase/rollback/20260827116000_router_v7_use_candidate_facts_cache_rollback.sql`
- `supabase/verify/20260827116000_router_v7_use_candidate_facts_cache_verify.sql`

Production changes were applied with guarded SQL transactions after the MCP
`apply_migration` wrapper rejected the complex payload before SQL execution.
Rollback files restore the backed-up function bodies from `obs_schema_backups`.

## Production Verification

Production checks passed:

- active V7 wrapper has `v7 initial section balance fast path`
- active V7 wrapper/ranker have `v7 candidate-facts cache substitution`
- active V7 wrapper/ranker no longer reference
  `public.obs_question_bank_with_dimensions`
- active V7 wrapper no longer contains the slow
  `from public.assessment_answers section_answer` recount block
- `obs_router_candidate_facts` has 1488 cached rows and 1488 valid candidates
- OT and NT app-facing RPC chains still resolve
- direct V7 smoke returned 10 renderable candidates

## After Timings

| Probe | Before | After |
|---|---:|---:|
| Direct `obs_rank_ot_assessment_candidates_v7` | ~2271 ms | ~1301 ms |
| App-facing `obs_get_next_ot_assessment_question` | ~1905 ms | ~1631 ms |

The direct ranker no longer reported temp block spill in the measured run.
The app-facing wrapper still reported temp blocks on an unanswered cold-start
attempt, so the next latency target is the pre-ranking cold-start/campaign path,
not the V7 candidate ranker itself.

## Recommendation

Stop here for this pass unless user testing still feels slow. The highest-signal
next backend speed pass would be:

1. Profile `obs_router_sync_campaign`, `obs_router_mode`, and
   `obs_get_next_ot_baseline_question_fast` separately on live-shaped attempts.
2. Add a cached `similarity_key` column to `obs_router_candidate_facts` and use
   it in V7 history checks.
3. Consider skipping campaign sync on true zero-answer cold-start attempts if it
   is proven to be a meaningful part of the remaining latency.
