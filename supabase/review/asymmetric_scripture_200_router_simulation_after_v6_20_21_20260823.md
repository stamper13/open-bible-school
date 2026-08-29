# Asymmetric Scripture 200-Question Router Simulation After V6.20/V6.21 - 2026-08-23

## Context

Production project: `idyavsqksxtgogpfwlei`

Simulation profile: `ASYMMETRIC_SCRIPTURE_200`

Execution path remained the app-facing OT RPC chain:
`obs_start_or_resume_ot_assessment_v2` -> `obs_get_next_ot_assessment_question`
-> `obs_submit_ot_assessment_response_v2`.

Because Supabase MCP HTTP calls timed out on one 4x50 run and on a single
50-question helper call, the completed rerun was chunked as 200 questions
across 15 forced attempts: five 20-question chunks followed by ten 10-question
chunks. This is not perfectly comparable to the earlier 4x50 shape, but it
does stress cross-attempt novelty harder.

All synthetic data and helper functions were removed after the run.

## Backend Changes Applied

1. `20260823170000_router_v6_20_history_aware_long_run_brakes.sql`
   - Adds cross-attempt exact-question and similarity-key history to the v6
     ranker.
   - Adds long-run dimension and section soft brakes.
   - Broadens high-specificity/chapter-addressed demotion outside dashboard
     foundation-gap candidates.
   - Captures the prior ranker body in `obs_schema_backups`.

2. `20260823171000_router_v6_21_count_widened_campaign_spend.sql`
   - Fixes campaign sync accounting so unit campaigns count same-book
     widened-scope evidence.
   - This was added after the 200-question rerun exposed a repeated Joshua
     geography item with `unit_key = null` that the ranker could serve in
     `widen_scope`, but the campaign state machine did not count.

## Comparison

| Metric | Before | After |
|---|---:|---:|
| Total answer rows | 200 | 200 |
| Scored rows | 200 | 200 |
| Exact distinct questions | 193 | 188 |
| Within-attempt exact repeats | 0 | 0 |
| Cross-attempt exact repeat rows | 7 | 12 |
| Similarity-cluster repeat rows | 10 | 12 |
| Latter Prophets served | 102 | 63 |
| Former Prophets served | 25 | 55 |
| Writings served | 37 | 33 |
| Torah served | 36 | 49 |
| Promise/prophecy served | 55 | 34 |
| Chapter-addressed rows | 69 | 0 |
| High-specificity rows | 75 | 16 |

## After Distribution

By OT section:

- Latter Prophets: 63 served, 15 books, 77.8% accuracy
- Former Prophets: 55 served, 7 books, 32.7% accuracy
- Torah: 49 served, 5 books, 71.4% accuracy
- Writings: 33 served, 10 books, 30.3% accuracy

By dimension:

- events_timeline: 55 served, 58.2% accuracy
- geography_nations: 41 served, 29.3% accuracy
- promise_prophecy: 34 served, 85.3% accuracy
- theological_reasoning: 33 served, 75.8% accuracy
- characters_lineage: 27 served, 48.1% accuracy
- law_commands: 10 served, 10.0% accuracy

## Important Finding

V6.20 improved the over-concentration and chapter-addressed problems, but the
chunked 200-question rerun exposed a campaign accounting defect:

- Joshua covenant-renewal geography item: 12 appearances
- Joshua geography overview item: 2 appearances

The repeated 12x item was a same-book widened-scope campaign candidate with
`unit_key = null`. The ranker was allowed to serve it for a `jos-1-12 /
geography_nations` campaign, but `obs_router_sync_campaign` only counted exact
unit-key rows for unit campaigns. The campaign stayed open instead of closing
after budget.

V6.21 fixes that accounting. A post-patch sync against the synthetic state
closed the stuck Joshua campaign as `budget_spent` with `items_spent = 14`, then
opened the next target. Synthetic rows were cleaned after this verification.

## Verdict

The first patch successfully reduced Latter Prophets / promise_prophecy and
chapter-address concentration, but it revealed that exact suppression alone is
not sufficient when a widened campaign can stay open without spend accounting.
V6.21 is required alongside V6.20 for launch safety.

Recommended next verification: rerun the same 200-question simulation through a
direct Postgres connection or a longer-running job after V6.21, preferably in
the original 4x50 shape, to confirm exact repeats fall instead of concentrating
in exhausted widened-scope cells.
