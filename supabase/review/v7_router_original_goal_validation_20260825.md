# V7 Router Original Goal Validation - 2026-08-25

## Purpose

Validate whether the current hardened V6 production path and V7 shadow router
are satisfying the original router goals:

- keep the app-facing OT RPC chain stable;
- preserve displayed BLI/scoring behavior;
- avoid exact and similarity repeats across attempts;
- reduce chapter-addressed prompts;
- cap long-run section/dimension concentration;
- support broad-to-narrow ladder routing rather than jumping into narrow
  chapter/detail questions too early.

## Cloud State Checked

Production project: `open-bible-school1`

- `obs_router_policy_config.active_version = 'V6'`
- `campaign_enabled = true`
- V7 shadow objects exist, but the live next-question RPC does not call V7.
- `obs_get_bli_scores_v2` does not read V7 metadata or V7 shadow logs.

Branch checked: `v7-router-shadow-replay`

- V7 shadow objects exist.
- V7 verifier passed under rollback.
- Temporary synthetic branch rows created for this audit were cleaned up.

## Verifier Results

The V7 shadow verifier passed under rollback on both production and the branch.

Key checks that passed:

- app-facing OT RPC chain still resolves:
  - `obs_start_or_resume_ot_assessment_v2`
  - `obs_get_next_ot_assessment_question`
  - `obs_submit_ot_assessment_response_v2`
- live next-question RPC does not call V7 shadow functions;
- displayed BLI RPC does not call V7 metadata or shadow functions;
- V7 ranker returns renderable multiple-choice candidates;
- V7 ranker joins ladder metadata for every returned row;
- narrow candidates cannot rank first while an eligible broader candidate exists;
- V7 shadow internals are not executable by `anon` or `authenticated`.

## Prior 200-Question Replay Comparison

The latest completed long-run replay after cache/hardening showed:

- Total rows: 200
- Scored rows: 200
- Distinct questions: 200
- Within-attempt exact repeats: 0
- Cross-attempt exact repeats: 0
- Similarity-cluster repeats: 0
- Unsupported drag/order rows: 0
- Chapter-addressed rows: 5
- High-specificity rows: 5

Compared with the original 2026-08-23 asymmetric replay:

- Latter Prophets dropped from 102/200 to 84/200.
- Former Prophets rose from 25/200 to 42/200.
- Chapter-addressed prompts dropped from 69/200 to 5/200.
- Cross-attempt exact repeats dropped from 7 to 0.
- Similarity-cluster repeats dropped from 10 to 0.

This means the original high-impact V6 goals are functioning in production.

## Ladder Behavior Audit

Branch-only synthetic learner:

- one OT attempt was created with zero answers;
- V7 candidates were inspected directly;
- eight broad/parent answers were added;
- one narrow incorrect answer was added;
- all synthetic branch rows and the temporary helper were removed afterward.

### Cold Start

At zero answers:

- V7 top candidate depth: 1
- V7 top candidate lane: `BROAD_OPEN`
- Top 25 depth 1-2 candidates: 25
- Top 25 depth 4-5 candidates: 0
- Top 25 blocked narrow candidates: 0
- Top 25 chapter-addressed candidates: 0

Verdict: cold-start behavior is broad first.

### Parent Evidence And Narrow Gate

After adding eight broad/parent answers:

- returned candidates: 75
- depth 1-2 returned: 55
- depth 3 returned: 13
- depth 4-5 returned: 7
- first narrow candidate rank: 55
- weak-area candidates: 26

The visible narrow candidates split correctly:

- candidates with two parent answers were marked `parent_evidence_present`;
- candidates with only one parent answer were marked
  `blocked_no_parent_evidence`;
- blocked candidates carried the reason `narrow candidate lacks parent evidence`
  and were pushed down.

Verdict: V7 is allowing narrow candidates only after parent evidence, and even
then narrow candidates do not dominate the top of the list.

### Narrow Miss Widening

After adding one incorrect chapter-detail answer:

- `WIDEN_AFTER_NARROW_MISS` candidates in top 15: 2
- best widen rank: 1
- narrow candidates in top 15: 0
- blocked narrow candidates in top 15: 0

Top two V7 candidates became book-overview 1 Kings geography questions, with
reason `widening after narrow miss`.

Verdict: when a learner misses a narrow detail, V7 widens back to broader
same-area evidence instead of piling on near-duplicate details.

### Chapter-Addressed Demotion

In the same synthetic state:

- returned candidates: 75
- chapter-addressed candidates returned: 7
- first chapter-addressed candidate rank: 62
- chapter-addressed candidates in top 25: 0
- exact chapter-recall candidates returned: 0

Verdict: chapter-addressed prompts are demoted rather than deleted, matching
the stated content philosophy.

## Current Assessment

The original goals are mostly functioning.

Working:

- V6 production routing is stable and still app-facing.
- V7 remains shadow-only.
- Displayed BLI is not using V7 metadata yet.
- Cross-attempt exact and similarity repeats are suppressed in the long-run
  replay.
- Chapter-addressed prompts are strongly demoted.
- Cold start is broad.
- Narrow detail requires parent evidence.
- A narrow miss widens back out.
- Section/dimension share brakes are visible in V7 reasons.

Remaining caution:

- V7 still depends on the widened V6 pool. If V6 does not surface a particular
  same-unit narrow candidate, V7 cannot introduce it.
- After the thin-evidence floor is crossed, V7 can see narrow candidates, but
  they remain relatively low in the ranking. That is launch-safe, but it means
  the ladder is conservative.
- Production replay still served `promise_prophecy` 55/200, even though other
  metrics improved. This is acceptable for V6 hardening, but V7 should be
  compared carefully before activation.

## Recommendation

Do not activate V7 yet.

Next best step: run a V6-vs-V7 shadow replay/report that logs the live V6 pick
and the V7 shadow pick at each step for controlled profiles. The specific gate
should compare:

- final BLI delta;
- section BLI ordering;
- section and dimension distribution;
- exact/similarity repeat counts;
- depth-stage distribution over time;
- parent-gate outcomes;
- chapter-addressed candidate ranks;
- get-next latency p50/p95.

If that report shows similar BLI and better ladder behavior, V7 can move to a
small internal/manual activation test.
