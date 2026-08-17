# BLI score-fidelity gates

## Purpose

This gate tests whether `bli_weighted_v2` recovers controlled learner profiles.
It does **not** test whether individual questions are biblically correct, clearly
worded, appropriately difficult, or discriminating for real learners.

Keep these release decisions separate:

| Gate | Evidence | Passing means |
|---|---|---|
| Score fidelity | `npm run test:bli-validation` | The formula recovers synthetic profile expectations within the thresholds below. |
| Item validity | Semantic, distractor, answer-key, calibration, and human-response review suites | The underlying questions are suitable evidence of biblical literacy. |

Neither gate substitutes for the other.

## Automated profile matrix

The score-fidelity harness runs:

- 20 heterogeneous profiles;
- 200 deterministic replications per profile;
- 30 answers in each of Torah, Former Prophets, Latter Prophets, and Writings;
- 4,000 assessments and 480,000 simulated responses total;
- production importance multipliers, chronological-weight ranges, IRT reward
  clamping, IDK handling, wrong-answer penalty, and 0–800 conversion.

## Acceptance thresholds

| Metric | Requirement |
|---|---:|
| Headline BLI mean absolute error | ≤ 40 points |
| Section-band recovery | ≥ 80% |
| Specialist section top-rank recovery | ≥ 90% |
| Interpretive section label | At least 15 eligible answers |
| “Established evidence” badge | At least 30 eligible answers |

The 15-answer floor is the upper end of the recommended 12–15 minimum. Scores
below it remain visible but must say **Provisional**. Scores from 15–29 answers
say **Developing evidence**. Thirty answers is the established threshold because
the repeated validation matrix first clears all three gates there.

## Current deterministic result

As of 2026-08-05:

- headline MAE: `34.91175` — pass;
- section-band recovery: `81.18125%` — pass;
- specialist top-rank recovery: `100%` — pass.

Run from `web/`:

```sh
npm run test:bli-validation
```

The command exits non-zero if any threshold regresses.

## Product behavior

The dashboard keeps the headline BLI visible. For OT sections it:

1. marks scores below 15 answers provisional;
2. routes the next follow-up assessment to the canonical section with the
   fewest eligible answers;
3. begins ordinary point-estimate weakness recommendations only after every
   canonical section reaches the interpretation floor;
4. reserves “Established evidence” for 30 or more answers.

The authenticated RPC `obs_get_bli_section_followup_v1` is the server contract
for the least-evidence route. Its migration includes explicit `EXECUTE` grants,
an authorization check, rollback, and verification SQL.
