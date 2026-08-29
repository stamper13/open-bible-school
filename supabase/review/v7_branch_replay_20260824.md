# V7 Branch Replay Status - 2026-08-24

## Branch

- Production project ref: `idyavsqksxtgogpfwlei`
- Development branch name: `v7-router-shadow-replay`
- Development branch id: `231151f5-fc8e-4b23-84a3-979526401a7e`
- Development branch ref: `goqgzeipwflwlfnymbaw`
- Hourly branch cost confirmed by user before creation: `$0.01344/hour`

No production schema or learner data was changed.

## Branch Setup

The Supabase branch initially had an empty schema/data state because Supabase
branch migration application failed from repository drift. To make the branch
usable for replay, I loaded the schema baseline from
`supabase/baseline/20260821011840_production_schema.sql`, then copied only
content/reference data from production:

- Biblical books, dimensions, learning units, events, entities, outlines, maps.
- OT generated question bank and review/status/reference tables.
- Coverage targets and dimension overrides.

I did not copy learner-facing tables such as `auth.users`,
`assessment_attempts`, `assessment_answers`, `user_abilities`, reading logs,
study plans, reports, or learner evidence.

Because the schema baseline is schema-only, I seeded the branch-only
`obs_router_policy_config` row for `OT_GENERAL`, then activated V6 on the
branch after migrations and verifiers passed.

## Applied Migrations

Successfully applied to the branch:

- V6 migrations through `20260823152400_router_v6_19_skip_reread_campaigns_for_sufficient_units.sql`
- `20260823171000_router_v6_21_count_widened_campaign_spend.sql`
- `20260823172000_router_v6_22_next_question_fallback.sql`
- `20260823173000_question_quality_rating_feedback.sql`
- `20260823174000_question_ladder_metadata_schema.sql`
- `20260824190000_question_ladder_metadata_backfill.sql`
- `20260824200000_v7_question_ladder_metadata_review.sql`
- `20260824201000_router_v7_shadow_mode.sql`

Special handling:

- `20260823143300_router_v6_13_unit_campaign_all_dimensions.sql` did not apply
  because its text patch expected an older ranker body, but its verifier passed:
  the branch ranker already has the required unit-campaign dimension widening.
- `20260823170000_router_v6_20_history_aware_long_run_brakes.sql` initially
  failed against the newer ranker ordering block. I updated the local migration
  to support that ranker shape and then applied it successfully.

## Verification

Local repo health:

- `npm --prefix web run test:backend-repo` passed.
- `npm --prefix web run test:migration-chain` passed.

Branch SQL verifiers passed:

- V6 step 13 through step 22 verifiers.
- Question quality rating verifier.
- V7 ladder metadata schema verifier.
- V7 metadata backfill verifier.
- V7 metadata review verifier.
- V7 shadow router verifier.

Cleanup check after cancelled replay attempts:

- `auth.users`: 0
- `assessment_attempts`: 0
- `assessment_answers`: 0
- `obs_router_campaign`: 0
- `obs_router_v7_shadow_log`: 0
- temp simulation helper: absent

## Replay Attempt

The existing 200-question replay script was run against the branch using the
app-facing RPC chain:

`obs_start_or_resume_ot_assessment_v2 -> obs_get_next_ot_assessment_question -> obs_submit_ot_assessment_response_v2`

Result: the full 200-question replay did not complete within the default
statement timeout. After increasing the session timeout, it still remained
active for several minutes and was cancelled manually.

I then created a scratch 80-question replay from the same script shape
(4 attempts x 20 questions). That also remained active for more than three
minutes and was cancelled manually.

The cancellation stack was consistently inside:

`obs_get_next_ot_assessment_question -> get_next_assessment_question -> obs_rank_ot_assessment_candidates_v6 -> obs_rank_ot_assessment_candidates_v5 -> obs_rank_ot_assessment_candidates_v4`

This is a performance gate failure, not an app-facing RPC crash and not a
scoring failure.

## Timing Probe

After refreshing planner stats on the bulk-loaded branch tables with `ANALYZE`:

- Cold synthetic user, V5 ranker, 0 prior answers: about 1.86 seconds for one
  top candidate.
- Synthetic user with 150 prior answers, V5 ranker: about 6.67 to 6.88 seconds
  for one top candidate.
- Synthetic user with 150 prior answers, V6 ranker after step 20: about
  7.82 seconds for one top candidate.

Interpretation:

- The added V6 step 20 guardrails appear to add roughly 1 second in this probe.
- Most of the late-run cost is inherited from the existing V5/V4 ranker path,
  especially after answer history grows.
- A 200-question replay on this branch is therefore not a trustworthy launch
  gate until ranker throughput is improved or the replay harness is optimized.

## Comparison Against 2026-08-23 Report

The previous report completed 200/200 questions and found:

- 7 exact cross-attempt repeat rows.
- 10 similarity-cluster repeat rows.
- Latter Prophets over-concentration: 102/200.
- `promise_prophecy` over-concentration: 55/200.
- Chapter-addressed prompts: 69/200.

This branch could not produce a comparable 200-question distribution because
router throughput failed before completion. The static verifiers show the
intended guardrails are installed, but dynamic replay has not proven the
distribution improvement yet.

## Recommendation

Do not promote V7 shadow or V6 step 20 changes further until the ranker
performance gate is fixed and the 200-question replay completes.

The next narrow fix should target late-run ranker throughput before changing
scoring or live routing behavior. Likely options:

- Precompute/reuse learner answer history summaries for the ranker call instead
  of repeatedly flowing through the V4/V5 candidate stack.
- Add a dedicated replay/performance verifier with a maximum acceptable
  single-call runtime after 150 prior answers.
- Consider moving long-run share and novelty calculations out of candidate
  generation and into a smaller post-rank rerank set.
