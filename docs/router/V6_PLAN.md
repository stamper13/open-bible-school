# Router v6 rollout plan

Status as of 2026-08-23. V6 is active in production with follow-up fixes for
dimension precedence, dashboard foundation gaps, and the Genesis 12-50
foundation probe routing bug.

## Migrations

| Step | File | What it installs | Risk |
|---|---|---|---|
| 1 | `20260822140000_router_v6_01_evidence_ledger.sql` | `obs_learner_evidence_ledger`, `obs_unit_antievidence`, sufficiency thresholds | None -- read-only, called by nothing |
| 2 | `20260822140100_router_v6_02_reread_mark.sql` | `obs_mark_unit_reread` | None -- new RPC, no existing caller |
| 3 | `20260822140200_router_v6_03_campaign_state.sql` | `obs_router_campaign` table, RLS, one-open-per-user index | None -- nothing reads it |
| 4 | `20260822140300_router_v6_04_mode_and_campaign.sql` | `obs_router_mode`, `obs_next_campaign_target`, `obs_router_sync_campaign` | None -- nothing calls them |
| 5 | `20260822140400_router_v6_05_rank_candidates.sql` | `obs_rank_ot_assessment_candidates_v6` with dimension-debt rerank | None -- unreachable until step 6 |
| 6 | `20260822140500_router_v6_06_activate.sql` | V6-capable `get_next_assessment_question` plus fast-selector cap | **Replaces a live function.** Behavior identical while `active_version = 'V5'` |
| 7 | `20260822140600_router_v6_07_reconcile_mode_with_evidence_floor.sql` | Mode boundary moved onto the dashboard's own evidence floor | None -- redefines `obs_router_mode`, which is inert while campaigns are disabled |
| 8 | `20260822140700_router_v6_08_dimension_precedence.sql` | Replaces the v6 ranker when step 5 was already applied before the dimension-precedence correction | None -- unreachable until activation |
| 9 | `20260822140800_router_v6_09_policy_version_constraint.sql` | Allows `active_version = 'V6'` in `obs_router_policy_config` | None until activation |
| 10 | `20260823143000_router_v6_10_dashboard_foundation_gap_lane.sql` | Adds a `FOUNDATION_GAP` lane so a dashboard unit-level foundation gap can inject its unanswered stage-1 item into V6 ranking | Low -- only fires for a focused ladder unit with no scoring stage-1 evidence |
| 11 | `20260823143100_router_v6_11_skip_fast_for_dashboard_foundation_gap.sql` | Adds a wrapper guard so the fast selector cannot shadow a foundation-gap lane | Low -- only changes `get_next_assessment_question` when the ladder focus lacks stage-1 evidence |
| 13 | `20260823143300_router_v6_13_unit_campaign_all_dimensions.sql` | Lets unit-level campaigns include all dimensions instead of only null-dimension questions | Low -- keeps dimension-specific campaigns narrowed |
| 14 | `20260823143400_router_v6_14_foundation_gap_over_campaign.sql` | Allows the `FOUNDATION_GAP` lane to outrank a dimension-specific campaign opened for the same unit | Low -- only for unanswered stage-1 foundation probes |

## Applied so far

Steps 1-11, 13, and 14 are live on production. Step 12 was an abandoned
pre-sync guard experiment and is intentionally not present. Step 8 exists
because editing step 5 locally is not enough once that migration version has
already been recorded in `schema_migrations`. Step 9 exists because one branch
still had the older policy-version check constraint allowing V3/V4/V5 only.

Production policy is `active_version = 'V6'`, `campaign_enabled = true`.

Follow-up steps 15-21 are now live on production as of 2026-08-23. The latest
two were added after the 200-question asymmetric learner simulation:

- Step 20 adds cross-attempt exact/similarity history to the v6 ranker, plus
  long-run dimension/section soft brakes and broader high-specificity demotion.
- Step 21 fixes campaign spend accounting for unit campaigns that serve
  same-book widened-scope candidates with a different or null `unit_key`.

Three defects were found by testing against production data and fixed:

1. **v5 is not limit-stable.** v6 originally asked v5 for a 3x pool and took
   the top N. v5's `section_candidate_ordinal` is a window over its input pool,
   so this moved 18 of 25 positions and broke the original cold-start
   passthrough guarantee. That guarantee has been retired: v6 now widens
   deliberately after the opening fast scan so dimension debt can matter.
2. **A wrapper cannot introduce candidates.** Promoting campaign items from
   v5's output produced zero picks -- none of the 38 `gen-12-50 /
   events_timeline` bank items reached v5's top N, because v5 ranks for
   breadth. Campaign candidates are now unioned in from the bank directly,
   in the same idiom v5 uses for its supplemental section screens.
3. **A hard `[1,1]` stage window deadlocks the open.** Every candidate in the
   cell was stage 2, so nothing qualified. Foundational-first is now an
   ordering on `candidate_stage`, with the ceiling as a cap rather than a
   narrow band.

Also hardened: `obs_is_authorized_user` returns NULL rather than false without
a JWT, so `if not (...)` guards fell through. All five v6 functions now
coalesce.

Follow-up defect fixed on 2026-08-23: the dashboard correctly recommended
Genesis 12-50 as a unit-level foundation gap, but campaign sync opened a
dimension-specific `events_timeline` reread campaign. That filtered out the
single unanswered stage-1 foundation item (`e31ead1e`, `geography_nations`) and
served stage-2 Genesis items instead. V6 now has a `FOUNDATION_GAP` lane that
can outrank that campaign only when the current ladder focus has foundation
items, no scoring stage-1 answer, and an unanswered stage-1 candidate. Live
smoke verified both `obs_rank_ot_assessment_candidates_v6` and
`get_next_assessment_question` return `e31ead1e` for that state.

Verified before the dimension-precedence revision: campaign mode on the real
account opened on `gen-12-50 / events_timeline` with reason `reread_retest` and
served 8 unseen Genesis items; an unauthenticated ledger call leaked no learner
evidence. Re-run the verification and profile replay after applying the revised
step 5.

## Gating decision (settled)

Campaign mode begins only once every canonical section reaches 15 answers.
Measured against the current database that admits 1 of 123 answering accounts
-- which is expected, not alarming: the population is almost entirely
single-session test accounts (213 of 218 have at most one completed
assessment; median answers per account is 1). Real repeat learners will cross
the floor; sham accounts never will, and should not.

The alternative -- letting the router drill from 2-3 answers per cell and
having the campaign take over the dashboard CTA -- remains available if the
floor later proves too conservative for genuine users. It needs a new RPC and
a `web/app/page.tsx` change, and it reintroduces the ownership conflict that
step 7 removes.

## Gates before activation

1. `supabase/verify/20260822_router_v6_verify.sql` passes after steps 6-9.
   Its most important
   checks are #9 and #12: in `cold_start` the v6 ranker may reorder but must
   draw only from the widened v5 pool, and the fast selector must be capped at
   no more than four scoring-eligible opening answers. If either fails, do not
   activate.
2. Profile replay covering: a cold-start learner, a returning learner with one
   confirmed weak Torah cell, a learner who rereads mid-campaign, and a learner
   whose target cell has only two bank items.
3. **Reconcile the fidelity gate.** Campaign mode intentionally unbalances
   per-attempt section coverage. `docs/validation/BLI_SCORE_FIDELITY_GATES.md`
   requires >=80% section-band recovery and routes dashboard follow-ups to the
   least-evidence section. Two things must be settled first:
   - the section-band metric must measure *cumulative* learner evidence, not
     per-attempt evidence;
   - the dashboard's least-evidence rule and the campaign must not both own
     "what next". The campaign should own it in campaign mode.
4. **Scoring is fine -- this is not a gate.** An earlier review flagged
   `bli_mean = 0` on all 722 attempt rows as a blocking scoring bug. It is
   not. `assessment_attempts.bli_mean` is a vestigial column: no frontend
   code reads it, and the live path is `obs_get_bli_scores_v2`, which returns
   correct values (OT display BLI 547, 320 answered, 76.3% accuracy for the
   reference account). The zero readings came from calling the RPC without a
   JWT, where `obs_is_authorized_user` denies and every count collapses to 0.

   Two real but non-blocking items remain from that review:
   - ~10% of answers carry `scoring_eligible = false`, so they are delivered
     but produce no evidence. Worth understanding; does not block v6.
   - `bli_mean` should be dropped or backfilled rather than left as a column
     that is always zero and always ignored.
5. Latency check. The v4 policy migration notes one ranking consumed roughly
   half the authenticated statement timeout on the free tier, which is why the
   fast path exists. v6 adds a wrapper over v5 over v4; measure before
   activating, and solve any regression with indexes rather than by
   reinstating the shadow.

## Activation

```sql
update public.obs_router_policy_config
set active_version = 'V6',
    campaign_enabled = true,
    updated_at = now()
where policy_key = 'OT_GENERAL';
```

## Rollback

```sql
update public.obs_router_policy_config
set active_version = 'V5',
    campaign_enabled = false,
    updated_at = now()
where policy_key = 'OT_GENERAL';
```

No migration needs reverting. The pre-v6 `get_next_assessment_question` body is
captured in `obs_schema_backups` under tag `20260822_router_v6`.

Partial levers, if the problem is narrower:

- `cold_start_uses_fast_selector = false` -- bypass the fast selector entirely
- `cold_start_fast_answer_limit` -- default 4; lower to reduce opening
  monoculture further, raise only if section rotation regresses in replay
- `campaign_max_items_per_attempt` -- lower it to weaken campaign influence
  without disabling it
- `cold_start_completed_attempts` -- raise it to keep more learners in breadth
  mode for longer

## Follow-up, not included here

- **Consolidation.** After v6 is stable, capture `pg_get_functiondef` verbatim
  for each router function into one definition migration so replay-from-zero
  equals production. The NT router already needed this once
  (`20260821130849`), and the v4/v5/v6 stack makes it more likely, not less.
- **Rename** `obs_get_next_ot_baseline_question_fast` to
  `obs_select_ot_cold_start_question`, once, during consolidation when nothing
  is in flight.
- **Do NOT build sweep-mode coverage debt.** This was the original plan and it
  is wrong. Sweep is only reachable once campaign has exhausted every
  insufficient cell, and the population cannot get there: of 218 accounts with
  attempts, 213 have at most one completed assessment, 211 were active on a
  single day, and the median user has answered 1 question. Building the
  coverage fix into sweep would place it exactly where no learner will ever
  be.

  The measured debt is real but it accrues in the two lanes that actually run.
  For the reference account the 192 routed items split 50/50, and each lane
  fails differently:

  | Lane | Items | Distinct dims | Over-served |
  |---|---:|---:|---|
  | Breadth screen | 96 | 5 | `events_timeline` 42 (44%) |
  | Ranked router | 96 | 7 | `promise_prophecy` 32 (33%, target 15.2%) |

  - **Breadth screen** is structurally single-dimension: all 40
    `section_competency_mcq_v1` items in the bank are `events_timeline`. No
    weighting can fully fix that; v6 limits the fast-selector exposure to the
    opening four scoring-eligible answers so this monoculture cannot consume
    most of a first assessment. The durable fix is still bank work.
  - **Ranked router** already contains `dimension_need`, `observed_share`, and
    `target_share` (confirmed in the v4 definition), yet still over-serves
    `promise_prophecy` 2x. So this is a PRECEDENCE bug, not a missing term:
    `route_priority` buckets and the v5 rerank both sort ahead of
    `adaptive_score`, leaving dimension_need to break ties inside a bucket
    rather than shape the distribution. v6 repairs this in the executing lane
    by widening the v5 pool and letting dimension debt outrank v5 route-bucket
    precedence for ordinary ranked candidates.

  Fix these two in the lanes that execute. Do not build a separate sweep-mode
  debt system until there is a population that reaches it.
