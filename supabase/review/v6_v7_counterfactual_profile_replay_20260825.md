# V6 vs V7 Counterfactual Profile Replay - 2026-08-25

## Purpose

Run a branch-only comparison between live V6 routing and V7 counterfactual
routing before any V7 activation decision.

This follows the validation recommendation from
`v7_router_original_goal_validation_20260825.md`.

## Important Method Note

Pure V7 shadow logging is not a fair replay by itself.

A tiny smoke run showed that a logged V7 shadow pick can repeat because the V7
pick is not actually answered. Since it is not inserted into
`assessment_answers`, V7 does not see its own shadow selections as history.

For this report, the meaningful comparison is therefore:

- `V6_LIVE`: uses the app-facing chain:
  `obs_start_or_resume_ot_assessment_v2` ->
  `obs_get_next_ot_assessment_question` ->
  `obs_submit_ot_assessment_response_v2`
- `V7_COUNTERFACTUAL`: starts the same kind of OT attempt, selects the top V7
  candidate directly, and submits that selected question through
  `obs_submit_ot_assessment_response_v2`

V7 remains shadow-only in production. No production learner-facing routing was
changed.

## Branch And Cleanup

Branch checked: `v7-router-shadow-replay`

Temporary helpers used:

- `obs_tmp_v6_v7_shadow_profile_replay_20260825`
- `obs_tmp_router_profile_replay_20260825`

Both helpers were dropped after the run.

Final cleanup audit:

- helper functions remaining: 0
- recent anonymous synthetic users: 0
- recent orphan attempts: 0
- recent orphan answers: 0
- recent orphan V7 shadow logs: 0

## Compact Matrix: 2 Attempts x 10 Questions

Each row below represents 20 routed/scored OT questions.

| Profile | Router | BLI | Accuracy | IDK | Exact repeats | Similarity repeats | Chapter addressed | Depth 4-5 | Section distribution |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| High knowledge | V6 live | 661 | 90.0% | 0.0% | 0 | 0 | 1 | 1 | Torah 5, Former 3, Latter 5, Writings 7 |
| High knowledge | V7 counterfactual | 775 | 100.0% | 0.0% | 0 | 0 | 0 | 0 | Torah 4, Former 2, Latter 11, Writings 3 |
| Weak Former | V6 live | 564 | 75.0% | 15.0% | 0 | 0 | 1 | 1 | Torah 5, Former 4, Latter 5, Writings 6 |
| Weak Former | V7 counterfactual | 208 | 45.0% | 15.0% | 0 | 0 | 0 | 0 | Torah 2, Former 6, Latter 10, Writings 2 |
| Weak Latter | V6 live | 480 | 70.0% | 15.0% | 0 | 0 | 1 | 1 | Torah 6, Former 4, Latter 7, Writings 3 |
| Weak Latter | V7 counterfactual | 390 | 70.0% | 5.0% | 0 | 0 | 0 | 2 | Torah 5, Former 3, Latter 9, Writings 3 |
| Noisy | V6 live | 226 | 50.0% | 10.0% | 0 | 0 | 1 | 1 | Torah 4, Former 6, Latter 5, Writings 5 |
| Noisy | V7 counterfactual | 492 | 70.0% | 15.0% | 0 | 0 | 1 | 0 | Torah 3, Former 2, Latter 11, Writings 4 |
| Asymmetric Scripture | V6 live | 256 | 50.0% | 15.0% | 0 | 0 | 1 | 1 | Torah 5, Former 6, Latter 4, Writings 5 |
| Asymmetric Scripture | V7 counterfactual | 342 | 65.0% | 5.0% | 0 | 0 | 0 | 0 | Torah 3, Former 4, Latter 9, Writings 4 |

## Single-Attempt Asymmetric Replay: 1 x 20

This shape better resembles a normal first assessment because the broad-open
floor is crossed once instead of resetting between two short attempts.

| Router | BLI | Accuracy | IDK | Exact repeats | Similarity repeats | Chapter addressed | Depth 4-5 | Section distribution | V7 lane mix |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| V6 live | 209 | 50.0% | 5.0% | 0 | 0 | 1 | 1 | Torah 7, Former 5, Latter 3, Writings 5 | n/a |
| V7 counterfactual | 272 | 55.0% | 10.0% | 0 | 0 | 3 | 0 | Torah 5, Former 4, Latter 9, Writings 2 | Broad open 8, Broad coverage 10, Weak area evidence 2 |

## Findings

1. Safety gates continue to look good.
   All compact runs scored every routed question, with 0 exact repeats and 0
   similarity repeats.

2. V7 is launch-safe on narrowness.
   V7 mostly selected depth 1-2 questions in these short runs. When it selected
   narrow depth 5 rows in the weak-Latter profile, both had
   `parent_evidence_present`.

3. V7 is still conservative on ladder depth.
   In 20-question runs, V7 usually stays broad or mid-level. This is safer than
   over-drilling, but it means V7 is not yet proving deep ladder descent in a
   first assessment.

4. V7 may over-lean Latter Prophets in short attempts.
   Several V7 20-question counterfactual runs gave Latter Prophets 9-11 of 20
   questions. That is not a crash or repeat issue, but it is the main caution
   before activation.

5. V7 can reveal weak areas more aggressively than V6.
   In the weak-Former profile, V7 asked more Former Prophets questions and the
   BLI dropped from 564 to 208. That looks like better diagnosis, not
   necessarily worse scoring.

6. BLI invariance is not proven by 20-question profiles.
   Short runs are too sensitive to which exact questions are selected. The
   200-question production replay is better evidence of stable BLI behavior.
   The compact matrix is best treated as a routing-behavior smoke, not a final
   psychometric equivalence test.

## Recommendation

Do not activate V7 yet.

The next V7 work should be narrow and targeted:

1. Investigate the short-run Latter Prophets concentration in V7.
2. Decide whether V7 should inherit V6's stronger early section balancing
   before the V7 metadata rerank.
3. Re-run a longer counterfactual V7 profile, ideally 80-200 questions, after
   the concentration question is settled.

V7 is closer philosophically than V6 on ladder/chapter suppression, but the
short-run Latter Prophets bias should be understood before any live rollout.
