# Question Bank Beta Readiness - 2026-08-27

## Scope

Reviewed whether the current question bank is good enough for beta production
after OT V7 routing was activated and after the public NT assessment was hidden
behind the `NEXT_PUBLIC_NT_PILOT_ENABLED=true` feature flag.

This was a read-only review. No question-bank data was changed.

## Recommendation

OT is acceptable for a small beta, with clear beta language and active feedback
collection.

NT should stay disabled publicly until the NT V7 incorporation task is complete.
The NT bank can serve questions, but it does not yet have the OT V7 ladder
metadata layer, has heavier coverage gaps, and has one blocked readiness scope
for Revelation/Apocalypse.

## Live Production Audit Snapshot

Production project checked: `idyavsqksxtgogpfwlei`

Question-bank audit view:

| Testament | Total questions | Router eligible | Blocked | With warnings | Chapter-address-like prompts |
|---|---:|---:|---:|---:|---:|
| OT | 1,168 | 1,160 | 8 | 1,140 | 380 |
| NT | 319 | 254 | 65 | 319 | 216 |

Readiness view:

| Scope | Active questions | Router eligible | Serving units | Blockers | Empty/below-min cells | Under-target cells | Status |
|---|---:|---:|---:|---:|---:|---:|---|
| OT | 1,168 | 1,160 | 1,156 | 8 | 46 | 51 | ready_with_gaps |
| Torah | 361 | 361 | 357 | 0 | 2 | 4 | ready_with_gaps |
| Former Prophets | 245 | 245 | 245 | 0 | 6 | 9 | ready_with_gaps |
| Latter Prophets | 339 | 339 | 339 | 0 | 14 | 25 | ready_with_gaps |
| Writings | 223 | 215 | 215 | 8 | 24 | 13 | ready_with_gaps |
| NT | 319 | 254 | 254 | 65 | 83 | 72 | ready_with_gaps |
| Gospels & Acts | 95 | 95 | 95 | 0 | 0 | 20 | ready |
| Pauline Epistles | 140 | 96 | 96 | 44 | 50 | 29 | ready_with_gaps |
| General Epistles | 75 | 57 | 57 | 18 | 30 | 19 | ready_with_gaps |
| Apocalypse | 9 | 6 | 6 | 3 | 3 | 4 | blocked |

Blocker reason for both OT and NT is currently `no_positive_coverage_target`.

## OT V7 Simulation Evidence

The latest 1,000-question V7 counterfactual replay showed:

- 1,000/1,000 scored rows.
- 1,000 distinct questions.
- 0 exact repeats.
- 0 cross-attempt exact repeats.
- 0 similarity-cluster repeats.
- 0 unsupported order/drag crash rows.
- 91.9% overall event-ID coverage.
- 99.3% broad/mid `events_timeline` event coverage.
- Ladder behavior worked: broad/mid questions dominated early, while depth 4-5
  questions appeared only after parent evidence existed.

This supports OT beta readiness from a router/scoring-safety perspective.

## Main OT Bank Risks

1. Chapter-addressed prompts are still too common.
   OT ladder metadata has 349 chapter-addressed prompts. The long-run V7 replay
   still served chapter-addressed prompts at 220-240 per 1,000 questions,
   depending on detection method. V7 demotes these, but the bank still contains
   enough of them that long sessions eventually surface many.

2. Some OT coverage cells are thin.
   The most meaningful gaps are Writings-heavy, especially cross-reference
   cells, plus a few Former Prophets cross-reference cells and specific
   Chronicles coverage. These are not launch blockers for a small beta, but they
   are the next content-improvement target.

3. Human quality feedback is sparse and currently negative-skewed.
   At review time, only 11 OT questions had quality ratings. Average question
   rating was 1.45/3, with 7 one-star ratings. This is not enough volume for a
   bank-wide conclusion, but it is a warning that beta should invite and triage
   question feedback aggressively.

4. Metadata review debt remains.
   OT V7 ladder metadata exists for all 1,168 OT questions, but many rows are
   still `needs_review`. This is acceptable for beta because V7 uses conservative
   demotion and fallback behavior, but it should not be treated as final-grade
   psychometric metadata.

## Product Readiness Call

Recommended beta posture:

- Enable OT assessment as beta.
- Keep NT assessment publicly disabled / coming soon.
- Keep BLI language as an educational estimate, not a credentialing-grade score.
- Keep the question rating/reporting UI visible.
- Review low-rated and reported OT questions regularly during beta.
- Prioritize rewriting/demoting chapter-addressed OT prompts over further router
  changes.

Not recommended yet:

- Do not present NT as production/beta-ready.
- Do not claim the OT question bank is fully validated.
- Do not use current BLI for high-stakes credentialing decisions.

## Next Question-Bank Work

1. Triage all open `inaccurate`, `wrong_answer`, and one-star OT feedback first.
2. Rewrite the most-served chapter-addressed OT prompts into event/order/context
   prompts.
3. Add or repair Writings and Former Prophets cross-reference coverage cells.
4. Continue collecting question ratings during beta until the sample is large
   enough to see patterns by book, dimension, and prompt shape.
5. Complete NT V7 ladder metadata and NT V7 shadow routing before reopening NT.
