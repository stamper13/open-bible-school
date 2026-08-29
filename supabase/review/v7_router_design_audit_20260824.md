# V7 Router Design Audit - 2026-08-24

## Verdict

V7 is ready for a non-production branch replay after the latest parent-gate
hardening. It is not ready for live routing or live/scored BLI changes.

The current implementation is appropriately conservative: it adds metadata,
review corrections, and a shadow ranker/log without changing the app-facing RPC
chain or displayed BLI. The design now expresses the V7 philosophy well enough
to test against synthetic long-run behavior.

## Reviewed Artifacts

- `docs/router/V7_ROUTER_AND_SCORING_PHILOSOPHY.md`
- `supabase/migrations/20260823174000_question_ladder_metadata_schema.sql`
- `supabase/migrations/20260824190000_question_ladder_metadata_backfill.sql`
- `supabase/migrations/20260824200000_v7_question_ladder_metadata_review.sql`
- `supabase/migrations/20260824201000_router_v7_shadow_mode.sql`
- `supabase/review/question_ladder_metadata_audit_20260824.md`
- `supabase/review/v7_question_ladder_metadata_human_review_20260824.md`
- `supabase/review/v7_shadow_router_comparison_20260824.md`
- `supabase/review/asymmetric_scripture_200_router_simulation_20260823.md`
- `supabase/review/asymmetric_scripture_200_router_simulation_after_v6_20_21_20260823.md`

## Goal Fit

V7's goal is still coherent:

- route broad-to-narrow;
- treat broad evidence as stronger global evidence;
- treat narrow evidence mostly as local/depth evidence unless parent scope is
  established;
- probe weak areas without trapping the learner in one section, book,
  dimension, unit, or prompt shape;
- keep strong areas alive through occasional stress tests;
- demote chapter-addressed and exact-chapter recall prompts;
- change no live routing or BLI until shadow evidence supports it.

The implemented artifacts broadly match that goal. The sidecar table gives the
router language it previously lacked: `routing_granularity`,
`scoring_scope_level`, `depth_stage`, global/local weights, review status, and
chapter-address flags.

## Implementation Fit

The implementation is launch-safe because V7 is shadow-only:

- `obs_rank_ot_assessment_candidates_v7` is service-only and `STABLE`.
- `obs_router_v7_shadow_log` is locked down with RLS and no direct
  anon/authenticated access.
- `obs_log_ot_assessment_v7_shadow_selection` appends shadow rows only and does
  not mutate answers, attempts, campaigns, or scores.
- The verify file checks that the live next-question RPC and
  `obs_get_bli_scores_v2` do not call V7 objects.

The largest limitation is deliberate: V7 reranks a widened V6 pool. That is the
right shadow-mode compromise, but it means V7 cannot choose a parent-scope item
that V6 never surfaces. If the replay shows V7 still failing to widen properly,
the next fix should add a V7-owned parent-scope supplement lane rather than keep
tuning weights inside the V6 pool.

## Parent Gate

The parent-evidence guardrail is necessary and now better aligned with the
philosophy.

Before this audit, narrow `depth_stage >= 4` items could count broad same-section
answers as parent evidence. That was too loose: two generic Torah answers should
not unlock a Genesis 15 passage detail.

The shadow migration now treats narrow parent evidence more tightly:

- if the narrow candidate has a `unit_key`, parent evidence must come from the
  same unit or same-book overview evidence;
- if the narrow candidate lacks a `unit_key`, parent evidence must come from the
  same book;
- broad section evidence alone does not unlock chapter/passage detail.

This is the most important pre-replay hardening change from the audit.

## Metadata Fit

The metadata schema is sufficient for shadow routing and likely sufficient for a
first shadow hierarchical BLI model. It is not sufficient for final live scoring
without more review and aggregation design.

Strengths:

- every live OT question is expected to receive one metadata row;
- all live OT questions had book and dimension mappings in the Task 3 audit;
- narrow rows receive low global signal and high local signal by default;
- exact-chapter and low-confidence rows are demoted through review status and
  rank penalties;
- review fixes corrected the exact class of mistake that could distort V7:
  chapter-addressed local details labeled as broad `book_intersection` evidence.

Risks:

- `payload.knowledge_granularity` is missing for most rows, so many labels are
  deterministic inferences rather than source-authored labels;
- 966 rows were low-confidence/needs-review in the simulated backfill;
- 343 chapter-addressed prompts remain in the unresolved review pool;
- the human review sampled only 40 high-risk rows and corrected 16;
- there is a report inconsistency to reconcile during branch replay: the Task 3
  audit says the labeler found 1 exact chapter recall row, while the human
  review report mentions a larger exact-chapter unresolved pool. The branch
  audit should clarify whether that larger number means exact chapter recall,
  chapter-range/addressed recall, or a separate audit category.

## Weak Areas

V7 should still probe weak areas meaningfully.

The shadow ranker identifies weak section/dimension evidence when answered
counts are at least three and accuracy is below 55%, then favors candidates at
depth stage 3 or lower. That matches the philosophy: weak areas should broaden,
confirm, and size before drilling into detail.

Risk: weak-area routing is still constrained by the V6 candidate pool. If V6
does not surface the right Former Prophets parent candidates, V7 cannot invent
them yet.

## Strong Areas

The stress-test behavior is present but conservative.

V7 labels candidates with `STRESS_TEST` when parent evidence is present and
`depth_stage >= 4`. This fits the idea that higher BLI ceilings are earned
through depth. The parent gate should keep this from becoming random narrow
trivia too early.

Risk: parent evidence is counted by answered rows, not correctness. That is
acceptable for branch replay but should be revisited before live routing:
stress tests should probably require enough correct parent evidence, not merely
answered parent evidence.

## Novelty And Caps

The ranker addresses the major V6 simulation failures:

- exact repeat history is ranked down;
- similarity-key history is ranked down;
- long-run section share brakes are applied before information/adaptive score;
- long-run dimension share brakes are applied before information/adaptive score;
- chapter-addressed and exact-chapter prompts are demoted;
- flagged/needs-review rows are demoted.

This should reduce the previous Latter Prophets / `promise_prophecy`
over-concentration and chapter-address concentration, but the replay must prove
it. The V6.20/21 report already showed that fixing one concentration pattern can
expose another accounting bug, so success must be measured across all four
attempts, not only by the first improvement.

## Shadow Log Fitness

The shadow log is good enough for branch replay debugging. It records:

- live and V7 question IDs;
- live and V7 scope/dimension;
- V7 granularity, scope level, and depth;
- V7 lane and reason;
- exact/similarity novelty flags;
- section/dimension share snapshots;
- parent gate and parent answered count;
- campaign phase/match and V7 campaign spend scope.

This should make a failed replay diagnosable without reading raw ranker SQL for
every item.

## Replay Success Criteria

Use these criteria before moving beyond branch shadow mode:

1. 200/200 responses complete and score through the app-facing RPC chain.
2. No unsupported drag/order crash rows.
3. No exact repeats within a 50-question attempt.
4. Cross-attempt exact repeats are lower than the pre-v6.20 baseline and do not
   concentrate in one campaign cell.
5. Similarity repeats are lower than or comparable to the pre-v6.20 baseline and
   explainable by bank exhaustion if present.
6. Latter Prophets should not exceed roughly 40% of the 200-question run unless
   the synthetic profile's weak/uncertain evidence justifies it.
7. `promise_prophecy` should not exceed roughly 20% of the run while other weak
   dimensions remain unresolved.
8. Former Prophets should receive meaningful coverage when the profile is weak
   there; target at least 40/200 in the asymmetric replay unless V7 logs show a
   clear reason not to.
9. Chapter-addressed prompts should remain substantially below the original
   69/200 baseline, with exact-chapter recall near zero unless intentionally
   selected late and demoted.
10. Top V7 shadow picks should not have
    `v7_parent_gate = 'blocked_no_parent_evidence'` when any non-blocked
    alternative exists.
11. Campaign-shaped V7 picks should always log a non-null
    `v7_campaign_spend_scope`.
12. Shadow V7 should preserve breadth: every 50-question attempt should include
    all four OT sections unless the attempt is explicitly scoped narrower.
13. Shadow V7 should still ask occasional strong-area stress tests, but those
    should be explainable through parent evidence.
14. Any V7 pick driven by `review_status in ('needs_review', 'flagged')` should
    be rare and explainable by candidate exhaustion.

## Recommendations

1. Apply the V7 schema, backfill, review, and shadow migrations to a
   non-production branch.
2. Run all V7 verify files in order on that branch.
3. Run the asymmetric 200-question replay in the original 4x50 shape if
   possible.
4. Compare live V6 picks with V7 shadow picks using `obs_router_v7_shadow_log`.
5. If V7 fails to widen/broaden, add a V7-owned parent-scope supplement lane
   instead of relying only on the widened V6 pool.
6. Do not build live hierarchical BLI until the branch replay shows the routing
   evidence ladder behaves sensibly.

## Final Status

Ready for branch replay. Not ready for production activation. Not ready for
displayed BLI changes.
