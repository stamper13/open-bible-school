# V7 Shadow Router Comparison - 2026-08-24

## What Was Built

Shadow-only V7 routing lives in:

- `supabase/migrations/20260824201000_router_v7_shadow_mode.sql`
- `supabase/rollback/20260824201000_router_v7_shadow_mode_rollback.sql`
- `supabase/verify/20260824201000_router_v7_shadow_mode_verify.sql`

It adds:

- `public.obs_rank_ot_assessment_candidates_v7(...)`
- `public.obs_router_v7_shadow_log`
- `public.obs_log_ot_assessment_v7_shadow_selection(...)`

The app-facing chain remains untouched:

`obs_start_or_resume_ot_assessment_v2` ->
`obs_get_next_ot_assessment_question` ->
`obs_submit_ot_assessment_response_v2`

## Guardrails Added

Three V7 guardrails are now explicit in the shadow implementation and verifier:

1. Narrow candidates with `depth_stage >= 4` are marked
   `blocked_no_parent_evidence` unless the learner already has at least two
   broader parent-scope answers. For narrow unit-mapped rows, parent evidence
   must come from the same unit or same-book overview rows; broad section
   evidence alone does not unlock chapter/passage detail. The ranker sorts
   blocked candidates behind any available candidate that is broad enough or
   parent-ready.
2. Campaign-shaped candidates expose `v7_campaign_spend_scope`, derived from
   the accepted candidate scope rather than only an exact unit key. Shadow mode
   still does not mutate campaign state, but the future accounting key is
   visible in logs and branch verification.
3. V7 remains shadow-only. The verifier checks that neither the live
   next-question RPC nor `obs_get_bli_scores_v2` calls V7 metadata, V7 ranker
   functions, or the V7 shadow log.

## Simulation Status

A full synthetic V6-vs-V7 replay was not feasible in this local environment:

- the Supabase CLI is not installed here;
- no local Supabase database was available through `supabase status`;
- the active cloud project reachable through MCP does not yet have
  `public.obs_question_ladder_metadata`, so the V7 ranker cannot run there
  without applying V7 metadata migrations to a branch.

The report therefore compares the implemented V7 shadow logic against the
latest available 200-question V6 asymmetric simulation reports:

- `asymmetric_scripture_200_router_simulation_20260823.md`
- `asymmetric_scripture_200_router_simulation_after_v6_20_21_20260823.md`

## Expected V7 Effects

Would V7 reduce Latter Prophets / `promise_prophecy` over-concentration?

Yes, by design in shadow ranking. V7 adds section and dimension long-run share
brakes before V6 route-priority tie breakers, and it records the share values
used. V6.20/21 already reduced Latter Prophets from 102/200 to 63/200 and
`promise_prophecy` from 55/200 to 34/200; V7 keeps those brakes and adds
metadata-aware demotion for narrow or review-risky candidates.

Would V7 improve Former Prophets coverage when Former Prophets are weak?

Likely. Weak section/dimension evidence can enter the `WEAK_AREA_EVIDENCE`
lane, but narrow probes are gated by parent evidence and share caps so the
router should widen through section/book/unit evidence rather than trapping the
learner in one cell.

Would V7 reduce chapter-addressed prompts?

Yes. `chapter_addressed_prompt` and `exact_chapter_recall_required` are explicit
ranking demotions. The metadata review also corrected sampled rows where
chapter-addressed structure questions had been given too much global signal.

Would V7 avoid exact and similarity repeats across attempts?

It should improve avoidance. V7 checks exact and similarity history across the
learner's prior scoped answers and ranks unseen candidates first while still
allowing repeats only when the widened pool is exhausted.

Would V7 preserve broad coverage while still investigating weak areas?

Yes in the intended shadow behavior. Thin evidence favors `BROAD_OPEN`, narrow
misses favor `WIDEN_AFTER_NARROW_MISS`, weak areas favor parent-scope evidence,
and strong parent scopes can still receive `STRESS_TEST` items.

Did V7 ever select a question only because metadata was wrong?

Not observed, because a full V7 replay was not executable here. The manual
review found exactly the kind of metadata error that could have caused this:
chapter-addressed `structure_cross_ref` rows labeled as broad
`book_intersection`. The correction migration and review-status demotions are
meant to prevent those rows from driving shadow choices.

## Remaining Work Before Live Consideration

- Apply V7 metadata + review + shadow migrations to a non-production branch.
- Run `20260824201000_router_v7_shadow_mode_verify.sql` on that branch.
- Run the asymmetric 200-question replay in the original 4x50 shape and compare
  live V6 question IDs with V7 shadow IDs in `obs_router_v7_shadow_log`.
- Continue human/content review of exact chapter recall and chapter-addressed
  rows, especially Genesis, Exodus, Isaiah, Jeremiah, Ezekiel, and high-use
  section-screen items.
- Build shadow hierarchical BLI separately; this change does not alter
  displayed BLI.
