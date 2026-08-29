# Asymmetric Scripture 200-Question Router Simulation - 2026-08-23

## Profile

Synthetic OT learner: `ASYMMETRIC_SCRIPTURE_200`

- Strong: Torah narrative except weak dimensions, Latter Prophets promise/prophecy
  and theological reasoning.
- Weak: Former Prophets, Writings, geography/nations, characters/lineage, and
  law/commands.
- Medium: Latter Prophets outside promise/theology.
- Execution path: app-facing OT RPC chain:
  `obs_start_or_resume_ot_assessment_v2` -> `obs_get_next_ot_assessment_question`
  -> `obs_submit_ot_assessment_response_v2`.
- Run shape: 200 answered questions across 4 capped 50-question attempts.
- Safety: temporary synthetic auth user only; cleanup performed after report.

## Top-Line Results

- Total answer rows: 200
- Scored rows: 200
- Exact distinct questions: 193
- Exact cross-attempt repeat rows: 7
- Within-attempt exact repeats: 0 in every 50-question attempt
- Similarity-cluster repeat rows: 10
- Unsupported order/drag response rows: 0
- Overall simulated accuracy: 61.5%
- IDK rate: 12.5%
- High-specificity rows: 75
- Chapter-addressed rows: 69

## Scoring Output

`obs_get_bli_scores_v2` with the synthetic user auth context:

- OT display BLI: 421
- OT accuracy: 61.5%
- OT answered: 200
- Correct: 123
- IDK: 25

Section scores:

- Latter Prophets: 606 display BLI, 80.4% accuracy, 102 answered
- Torah: 434 display BLI, 61.1% accuracy, 36 answered
- Writings: 149 display BLI, 37.8% accuracy, 37 answered
- Former Prophets: 46 display BLI, 20.0% accuracy, 25 answered

Scoring verdict: directionally correct. The strongest simulated section scored
highest, the weakest section scored lowest, and mixed Torah landed in the
middle because weak dimensions inside Torah pulled it down.

## Routing Distribution

By OT section:

- Latter Prophets: 102 served, 17 books represented, 80.4% accuracy
- Writings: 37 served, 10 books represented, 37.8% accuracy
- Torah: 36 served, 5 books represented, 61.1% accuracy
- Former Prophets: 25 served, 7 books represented, 20.0% accuracy

By dimension:

- promise_prophecy: 55 served, 83.6% accuracy
- events_timeline: 46 served, 56.5% accuracy
- theological_reasoning: 41 served, 68.3% accuracy
- law_commands: 20 served, 45.0% accuracy
- geography_nations: 19 served, 31.6% accuracy
- characters_lineage: 19 served, 42.1% accuracy

By simulated skill band:

- strong_latter_prophecy_theology: 70 served, 87.1% accuracy
- weak_scope_writings: 26 served, 34.6% accuracy
- weak_dimension_law: 20 served, 45.0% accuracy
- weak_dimension_geography: 19 served, 31.6% accuracy
- weak_dimension_characters: 19 served, 42.1% accuracy
- medium_scope_latter: 17 served, 76.5% accuracy
- strong_scope_torah: 15 served, 93.3% accuracy
- weak_scope_former: 14 served, 21.4% accuracy

## Findings

1. Crash prevention looks good.
   The 200-question run produced 200 scored rows and zero unsupported
   order-response rows.

2. Same-sitting duplicate prevention looks good.
   Each 50-question attempt served 50 distinct questions with all four OT
   sections represented.

3. Cross-attempt novelty is still weak.
   Seven exact repeat rows appeared across attempts. The most repeated items
   were:
   - Ezekiel 34 bad shepherds promise: 4 total appearances
   - Ezekiel two sticks / dry bones promise: 3 total appearances
   - Former Prophets section-screen item: 3 total appearances

4. Promise/prophecy is probably over-concentrated.
   It received 55/200 questions and Latter Prophets received 102/200. Some of
   this is appropriate because the profile was strong there and the bank has
   many live items, but long-run routing should still maintain a tighter max
   share.

5. Weak areas are being probed.
   Geography, characters, law, Writings, and Former Prophets all received
   meaningful coverage and scored low as expected.

6. Chapter-addressed prompts remain too common.
   69/200 prompts contained explicit book+chapter references. Many are valid
   passage questions, but the experience still leans too much toward
   chapter-address recall.

7. Ladder/recommendation state needs a display/focus follow-up.
   `obs_get_user_recommendation_v2` recommended Exodus 21-40 with display score
   501 vs required 513, which is reasonable. But `obs_get_ladder_state_v1`
   still showed some high-display-score units as `insufficient_evidence`,
   including Genesis 12-50 as a focus row. That may be a foundation-evidence
   distinction, but it can look contradictory and should be clarified or hidden
   in the UI/ranking.

## Recommended Next Backend Fixes

1. Add cross-attempt exact-question suppression to campaign and section-screen
   candidates unless the bank for the target cell is truly exhausted.
2. Add a long-run dimension max-share guard so promise/prophecy cannot dominate
   25%+ of a 200-question sequence when other weak dimensions remain.
3. Rewrite or demote chapter-addressed prompts, starting with high-use Genesis,
   Ezekiel, and section-screen items.
4. Clarify ladder state so high display scores with missing foundation evidence
   do not look like ordinary mastery.
