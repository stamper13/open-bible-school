# Question Selection Improvement Plan - 2026-08-21

This ranks the remaining backend work after the production launch router fixes.

## Ranked Work

1. Duplicate-family metadata and audits.
   Runtime duplicate suppression now works, but explicit `stem_family`
   metadata is still sparse. The next best improvement is to identify likely
   repeated/rephrased clusters so they can be tagged, merged, rewritten, or
   removed.

2. Router regression gates.
   Keep OT/NT variation, section coverage, performance, and no-repeat behavior
   runnable as one launch gate before every backend migration.

3. NT taxonomy refinement.
   Decide whether the current `GOSPELS_ACTS` routing bucket should be split
   into separate `GOSPELS` and `ACTS` skill areas.

4. Question-bank coverage balancing.
   Identify underrepresented book/dimension combinations and create targeted
   authoring queues for gaps.

5. Router performance hardening.
   Add explain-plan checks and narrow indexes around the hot next-question
   selectors.

6. Scoring calibration review.
   Compare synthetic profiles plus real answer evidence to make sure BLI
   movement remains plausible across short and longer assessments.

## Step 1 Artifact

Run the duplicate audit with:

```bash
cd /Users/stamper35/open-bible-school
export SUPABASE_DB_URL='YOUR_DATABASE_CONNECTION_STRING'
scripts/run-question-duplicate-audit.sh
```

The script writes a timestamped report to `supabase/review/`.

## Step 1 Result

Production report:

- `supabase/review/question_similarity_duplicate_audit_20260821132949.txt`

Key findings:

- OT has 1,171 eligible questions; 199 have explicit `stem_family`, 972 do
  not.
- NT has 319 eligible questions; none currently have explicit `stem_family`.
- The current runtime similarity key found 9 multi-row OT similarity clusters.
- The audit found 5 high-priority OT clusters where missing `stem_family`
  metadata could allow rephrased/sibling questions to appear too close
  together.
- No same-answer missing-family NT clusters were found by this conservative
  audit.

Recommended next action:

- Review the 5 high-priority OT clusters in the report and decide whether each
  should get explicit `stem_family` metadata, be rewritten, or be quarantined.

## Step 2 Artifact

Router regression gates are now bundled in one command:

```bash
cd /Users/stamper35/open-bible-school
export SUPABASE_DB_URL='YOUR_DATABASE_CONNECTION_STRING'
scripts/run-assessment-routing-regression-gate.sh
```

The gate runs:

- OT fast-selector structural verifier.
- NT question-bank optimization verifier.
- NT router-balance verifier.
- NT attempt summary counter-sync verifier.
- NT evidence-backed attempt summary backfill verifier.
- Combined OT/NT synthetic profile simulation.
- Question duplicate audit.

Optional environment switches:

- `RUN_LIVE_SMOKE=1` includes the public anonymous API smoke test. It is
  opt-in because repeated anonymous sign-ins can trip Supabase Auth rate
  limits.
- `SKIP_DUPLICATE_AUDIT=1` skips the longer diagnostic duplicate report.
- `LAUNCH_TESTAMENT=OT` or `LAUNCH_TESTAMENT=NT` narrows the synthetic profile
  simulation.

## Steps 3-6 Artifact

Run the broader read-only backend assessment health audit with:

```bash
cd /Users/stamper35/open-bible-school
export SUPABASE_DB_URL='YOUR_DATABASE_CONNECTION_STRING'
scripts/run-assessment-backend-health-audit.sh
```

The audit covers:

- NT Gospels/Acts split readiness.
- Book-level NT router supply.
- Recent NT served distribution.
- Coverage status and highest-priority question-bank gaps.
- Router hot-path function/index inventory.
- Real attempt counter consistency.
- Real answer scoring signal shape.
- Calibration item residual summary.

## Steps 3-6 Result

Production evidence gathered on 2026-08-21:

- `GOSPELS_ACTS` is contract-sensitive because the frontend currently treats it
  as one public section in `web/lib/bibleTaxonomy.ts` and related score/focus
  displays.
- The question bank is supply-ready for a future split: Gospels currently have
  76 router-eligible questions, and Acts has 19 router-eligible questions.
- The launch-safe choice is to keep the public `GOSPELS_ACTS` bucket for now,
  while using the new audit to measure whether Acts is under-served before
  changing the frontend/backend score contract.
- Coverage gaps are now measurable; the first curation queue should prioritize
  positive-target cells that are `empty`, `below_minimum`, or `under_target`.
- The scoring/resume audit found a concrete NT issue: successful NT submissions
  returned correct counts to the client but did not persist `answered_count`,
  `correct_count`, or `is_complete` on `assessment_attempts`.
- Fixed in production with migration
  `20260821134530_sync_nt_attempt_summary_on_submit` and verified with
  `supabase/verify/20260821134530_sync_nt_attempt_summary_on_submit_verify.sql`.
- Existing evidence-backed NT attempts were reconciled with migration
  `20260821135405_backfill_nt_attempt_summary_counts`; it updated 6 attempts
  and passed
  `supabase/verify/20260821135405_backfill_nt_attempt_summary_counts_verify.sql`.

Remaining cleanup after launch:

- Decide whether to split `GOSPELS_ACTS` into `GOSPELS` and `ACTS` as a public
  scoring/display contract change.
- Add explicit NT `stem_family` metadata; current NT rows have no explicit
  families, even though the conservative duplicate audit did not find high-risk
  same-answer clusters.
- Work through the coverage-gap curation queue and author or repair missing
  book/dimension cells.
- Review historical stale OT counters separately. The launch patch only
  reconciled NT attempts where answer rows made the correction unambiguous.
