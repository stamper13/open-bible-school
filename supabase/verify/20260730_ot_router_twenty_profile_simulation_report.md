# OT Router Twenty-Profile Simulation Report

Date: 2026-07-30

## Method

Twenty deterministic learner profiles completed 20 routed OT questions each
(400 routed items total). Each simulation used the production question-selection
and answer-submission path. Synthetic attempts, answers, abilities, and users were
removed after each run; only the temporary transcript table was retained for
analysis.

This is a behavioral router test, not a psychometric validation study. It checks
whether selection reacts sensibly to controlled response patterns. It cannot
estimate real-world measurement validity without human response data.

## Global Invariants

| Check | Result |
| --- | ---: |
| Profiles completed | 20 / 20 |
| Questions routed | 400 |
| Duplicate question IDs within a session | 0 |
| Maximum appearances of one book in a session | 5 |
| Exploration items | 40 (10.0%) |
| Persistent section theta used | 10 |
| OT theta used | 0 |
| Session fallback used | 390 |

Novelty, the per-book concentration cap, and the exploration quota all worked.
The heavy use of session fallback needs follow-up: it makes the assessment
responsive to the current session, but existing learner ability has little
influence during most synthetic general-assessment selections.

## Profile Summary

| Profile | Avg stage | First 5 | Last 5 | Orientation | Books | Correct / Missed / Skipped |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Novice | 1.70 | 1.80 | 1.60 | 5 | 14 | 6 / 3 / 11 |
| Beginner improving | 1.50 | 1.00 | 1.00 | 10 | 15 | 12 / 3 / 5 |
| Expert | 2.45 | 1.60 | 2.80 | 1 | 14 | 17 / 3 / 0 |
| Broad intermediate | 1.50 | 1.80 | 1.00 | 11 | 16 | 11 / 8 / 1 |
| Torah weak | 1.40 | 1.40 | 1.60 | 7 | 8 | 13 / 3 / 4 |
| Torah strong, Former weak | 1.40 | 1.20 | 2.00 | 9 | 9 | 13 / 3 / 4 |
| Former strong, Latter weak | 1.80 | 1.20 | 1.60 | 2 | 11 | 12 / 5 / 3 |
| Prophets strong, foundation weak | 1.40 | 1.40 | 1.00 | 8 | 11 | 11 / 1 / 8 |
| Writings weak | 1.90 | 1.40 | 2.20 | 2 | 12 | 12 / 6 / 2 |
| Minor Prophets weak | 2.15 | 1.40 | 2.20 | 2 | 14 | 16 / 4 / 0 |
| Geography weak | 2.20 | 1.20 | 2.80 | 3 | 11 | 15 / 4 / 1 |
| Theological Reasoning weak | 2.30 | 1.80 | 2.40 | 1 | 9 | 13 / 6 / 1 |
| Law weak | 2.00 | 1.60 | 2.00 | 2 | 10 | 14 / 3 / 3 |
| Characters weak | 2.25 | 1.60 | 2.40 | 2 | 10 | 14 / 5 / 1 |
| Events weak | 1.95 | 1.40 | 2.20 | 1 | 11 | 12 / 4 / 4 |
| IDK heavy | 1.00 | 1.00 | 1.00 | 13 | 13 | 9 / 2 / 9 |
| Noisy alternating | 1.55 | 1.20 | 1.60 | 7 | 16 | 10 / 10 / 0 |
| Fatigue decline | 2.10 | 1.80 | 2.20 | 1 | 8 | 11 / 2 / 7 |
| Stale high theta | 1.30 | 1.60 | 1.00 | 11 | 12 | 9 / 7 / 4 |
| High-SE uncertain | 1.75 | 2.20 | 1.80 | 8 | 12 | 14 / 5 / 1 |

## What Worked

1. **High and low extremes separate correctly.** The expert rose to Stage 3,
   while the IDK-heavy learner remained at Stage 1.
2. **Prerequisite fallback works.** A learner strong in prophetic material but
   weak in the historical foundation was routed back toward Torah, Former
   Prophets, Chronicles, and Ezra-Nehemiah at low stages.
3. **Scope weakness generally downshifts.** Torah, Former Prophets, Latter
   Prophets, and Writings weakness profiles mostly received low-stage questions
   in their weak scope.
4. **Session variety is strong.** No duplicate questions appeared, the five-item
   book cap held, and broad profiles commonly covered 14-16 books.
5. **Exploration is controlled.** Exactly 10% of routed items were exploratory.

## Defects And Tuning Needs

### 1. Recovery after early struggle is too brittle

The improving learner reached Stages 2 and 3 after several correct answers, but
two misses pushed it back to a run of five Stage-1 orientation questions. The
router can promote, but recovery after demotion is too slow and orientation
questions become a fallback loop.

Recommended change: use a short rolling evidence window. Two misses may demote
one stage, while three recent correct responses should permit promotion again.
Do not reset directly from Stage 3 to an orientation loop unless the misses are
in the same prerequisite scope.

### 2. Fatigue downshifts the item but not the target

The fatigue profile began strongly, then skipped seven later questions. Selected
items stepped down from Stage 3 to 2 and 1, but `target_stage` remained 3. This
keeps Stage-3 pressure in ranking even while the visible candidate stage falls.

Recommended change: make the recent-session brake adjust the effective target,
not only the candidate-stage fallback. Two recent misses/IDKs should lower the
target one stage; recovery should require new positive evidence.

### 3. Dimension adaptation is inconsistent

All targeted weak-dimension questions were missed or skipped, but:

| Weak dimension | Targeted items | Later-half items | Avg stage |
| --- | ---: | ---: | ---: |
| Characters & Lineage | 2 | 1 | 2.50 |
| Events & Timeline | 6 | 4 | 2.00 |
| Geography & Nations | 2 | 0 | 1.50 |
| Law & Commands | 3 | 1 | 2.33 |
| Theological Reasoning | 4 | 2 | 3.00 |

Theological Reasoning is the clearest failure: the learner missed every targeted
item yet continued receiving that dimension at Stage 3. Geography may be
under-confirmed, while Events may be over-pursued.

Recommended change: add a lightweight recent-session dimension brake, not a new
per-dimension theta model. After two misses/IDKs in one dimension, lower that
dimension's target by one stage and collect at most one confirmation item before
moving on.

### 4. Persistent theta behavior needs a production-like replay

The synthetic setup produced session fallback on 390 of 400 selections. The
stale-theta and high-SE profiles were therefore not conclusive tests of persisted
ability behavior.

Recommended test: clone a real, anonymized response history into a transaction,
run old and new selection for the same learner state, then roll back. Verify how
theta, theta SE, recency, and section scope affect every selected item.

### 5. Performance needs measurement

One 20-item simulation took roughly 40 seconds; three concurrent profiles took
roughly 55-75 seconds. The harness includes answer recording and theta updates,
so this is not a clean per-request benchmark, but it is enough to justify an
`EXPLAIN (ANALYZE, BUFFERS)` pass on next-question selection and submission
before public load.

## Behavioral Verdict

Approximately half of the profiles were clean passes, most of the remainder
were directionally sensible but exposed tuning needs, and two patterns were
clear failures: late fatigue and a persistent weak dimension at high difficulty.
The router is suitable for a controlled beta after those two failure modes and
query performance are addressed. It is not yet evidence of psychometric
validity; that requires real-user calibration and outcome analysis.
