# OT Router Validation Report

Date: 2026-07-31

## Test Correction

The original synthetic replay used `now()` for every answer inside one
transaction. PostgreSQL keeps `now()` constant for the transaction, so all
answers tied on `answered_at` and the router's UUID tie-breaker scrambled their
apparent recency. The harness now assigns monotonically increasing timestamps
while keeping each timestamp before the transaction clock used during answer
submission.

## Corrected Baseline

### Fatigue decline

Run: `9d1b5fbf-e100-455a-b13d-80a86295496c`

- First-ten average selected stage: `2.00`
- Last-ten average selected stage: `1.30`
- Target stages: `1,1,1,2,2,2,2,3,3,3,3,2,1,1,1,1,1,1,1,1`

Conclusion: the existing global session brake already responds correctly to
immediate and sustained struggle. No global-brake rewrite was warranted.

### Beginner improving

Run: `357b3aff-b383-4c7a-a32c-fea99f088799`

- First-six average selected stage: `1.00`
- Remaining-nine average selected stage: `1.89`
- Target stages: `1,1,1,1,1,1,1,2,3,3,3,3,3,3,3`

Conclusion: recovery is not a one-way ratchet. Sustained success raises the
target from foundational questions to core and detail questions.

## Confirmed Defect

### Theological-reasoning weakness before the fix

Run: `e41943db-9e1d-405c-b92d-e0d0e46ce5f6`

The three theological-reasoning selections were:

1. Item 3, stage 1, missed
2. Item 8, stage 3, missed
3. Item 14, stage 3, missed

Strong performance in other dimensions raised the global target and overrode
the evidence that this dimension was weak.

## Applied Correction

Migration: `20260731220000_ot_router_dimension_brake.sql`

- Two misses or IDK responses in one dimension lower only that dimension by
  one stage for the remainder of the current assessment.
- The information target is lowered with the stage target so the IRT term does
  not continue favoring a hard item.
- The router may ask one additional confirmation item, then deprioritizes that
  dimension for the rest of the session.
- Global theta, section theta, and the existing fatigue/recovery rules remain
  unchanged.

### Theological-reasoning weakness after the fix

Run: `15358797-6b90-4f6d-8d7b-87265002d5c4`

The three theological-reasoning selections were:

1. Item 3, stage 1, missed
2. Item 8, stage 3, missed
3. Item 13, stage 1, correct

No fourth theological-reasoning item was selected. This is the intended
diagnose, confirm at an appropriate level, then move-on behavior.

## Remaining Limitation

These are deterministic synthetic profiles, not psychometric validation.
Before claiming calibrated adaptivity, the project still needs production
response-volume monitoring, item calibration review, and periodic replay on a
staging clone of production.
