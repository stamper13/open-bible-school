# OT Router Five-Profile Simulation Report

Date: 2026-07-29

## Method

Five synthetic users completed 20-question OT sessions through the live
`obs_rank_ot_assessment_candidates_v4` router and the production submission
path. Responses were deterministic for each learner profile. Synthetic users,
attempts, answers, and ability rows were deleted after every run.

The final replay occurred after installing:

- orientation graduation after demonstrated competence;
- the recent-performance session brake;
- a soft book-concentration penalty after three questions; and
- an absolute five-question same-book ceiling in general OT assessments.

## Final Results

| Profile | Avg stage | Stage 1 | Stage 2 | Stage 3 | Orientations | Books | Correct | Missed | Skipped | Max/book |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Advanced, geography weak | 2.50 | 1 | 8 | 11 | 1 | 12 | 17 | 2 | 1 | 5 |
| Broad intermediate | 1.90 | 5 | 12 | 3 | 2 | 10 | 14 | 1 | 5 | 3 |
| Narrative strong, prophets weak | 1.60 | 10 | 8 | 2 | 10 | 15 | 14 | 2 | 4 | 5 |
| Novice | 1.50 | 11 | 8 | 1 | 10 | 16 | 10 | 3 | 7 | 5 |
| Prophets strong, foundation weak | 1.25 | 15 | 5 | 0 | 13 | 14 | 11 | 3 | 6 | 5 |

## Evaluation

The final router behavior matches the intended policy much better:

- Strong learners graduate quickly. The advanced profile received 11 Stage 3
  items and only one orientation question.
- The broad-intermediate learner received a mixed Stage 1-3 assessment across
  10 books, with only two orientation questions.
- Learners who struggle in a region receive more book-orientation probes. This
  is visible in the novice, prophets-foundation-weak, and
  narrative-strong/prophets-weak profiles.
- No book exceeded the hard five-question ceiling. The broad learner's most
  frequent book appeared only three times.
- The session brake downshifted difficulty when recent answers contradicted
  the stored or inferred ability estimate.

The orientation count for struggling profiles is intentionally not a fixed
global quota. Orientation is now a diagnostic fallback: it largely disappears
for demonstrated learners but remains available when the learner cannot yet
support detailed questions.

## Distractor Audit

The private semantic review queue was installed and verified. It currently
contains:

| Priority | Questions | Queued |
| --- | ---: | ---: |
| 1 | 138 | 138 |
| 2 | 988 | 988 |
| 3 | 89 | 0 |

Priority 3 contains the 89 questions already marked as having same-category
distractors, so they are recorded as reviewed rather than returned to the
queue. The audit does not automatically rewrite or quarantine questions.
