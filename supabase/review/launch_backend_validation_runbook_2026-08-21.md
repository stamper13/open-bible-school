# Launch Backend Validation Runbook - 2026-08-21

This is the narrow pre-launch backend gate. It intentionally ignores broad
schema cleanup and focuses on assessment routing, variation, and scoring.

## What This Validates

- OT assessment startup uses the current app-facing RPC path.
- OT next-question routing uses the fast selector with early seeded variation.
- NT assessment startup and next-question routing still work.
- OT and NT answer submission paths update attempts and score evidence.
- Synthetic learner profiles produce plausible per-testament BLI scores.
- Fresh attempts use a broader set of first questions.
- The router avoids exact repeated questions and flags same-similarity repeats.

## One-Time Production Sequence

Run these from the repo root with the production Postgres URL exported in your
terminal. Do not paste the password into committed files.

```bash
cd /Users/stamper35/open-bible-school
export SUPABASE_DB_URL='postgresql://postgres:YOUR_PASSWORD@db.idyavsqksxtgogpfwlei.supabase.co:5432/postgres'
scripts/apply-launch-router-fix.sh
scripts/run-launch-assessment-simulation.sh
```

The simulation script writes a timestamped report to `supabase/review/`.

The simulation runner accepts optional filters for smaller checks:

```bash
LAUNCH_TESTAMENT=OT scripts/run-launch-assessment-simulation.sh
LAUNCH_TESTAMENT=NT LAUNCH_QUESTION_COUNT=12 scripts/run-launch-assessment-simulation.sh
```

If the direct `db.<project-ref>.supabase.co` URL times out locally, use the
connection string shown in Supabase Dashboard -> Project Settings -> Database.
On some networks the direct host resolves only to IPv6; the Supabase pooler
connection string is usually the more reliable option.

## Browser-Path Smoke Test

This alternate smoke test uses the public Supabase URL/key from
`web/.env.local`, signs in anonymous users through Auth, and exercises the
same HTTPS RPCs as the browser:

```bash
cd /Users/stamper35/open-bible-school
node scripts/run-live-assessment-variation-smoke.mjs
```

This validates live first-question variation and repeated-question behavior,
but it cannot intentionally answer "correct" by synthetic skill profile because
the browser API correctly hides answer keys. Use the SQL simulation above for
scoring profiles.

## Interpreting Results

The first table is the launch gate summary:

- `PASS`: acceptable for launch.
- `WARN: similar duplicate cluster repeated`: inspect the prompts; a small
  number may be acceptable, but repeated rephrases in one assessment should be
  fixed before launch.
- `WARN: OT coverage too narrow` or `WARN: NT coverage too narrow`: router is
  concentrating too much in one section/division.
- `WARN: weak area under-probed`: synthetic weak areas are not being sampled
  enough to produce useful diagnostic feedback.
- `FAIL: too few questions served`: blocker.
- `FAIL: exact question repeated`: blocker.

The second table checks first-question variation. For the current two runs per
profile, a launchable result should show more than one distinct first question
for OT and NT. OT should improve materially after
`20260821125302_diversify_ot_baseline_fast_selector.sql`.

The third table checks final score sanity. Beginner profiles should score
lower than advanced profiles. Profiles with targeted weaknesses should not look
uniformly excellent across the relevant testament.

The fourth table shows per-scope distribution so the weak/strong behavior can
be inspected quickly.

## Production Result - 2026-08-21

After restarting the project and applying the launch router patches, production
passed the combined OT/NT SQL launch simulation:

- Report:
  `supabase/review/launch_assessment_router_profile_simulation_20260821130942.txt`
- 8/8 synthetic profiles passed.
- OT and NT each served 12/12 distinct questions per profile.
- No exact repeated questions.
- No repeated similarity clusters.
- NT covered all four NT divisions in each 12-question profile run.
- Scores moved in the expected direction: beginner profiles scored low,
  advanced profiles scored high, and targeted-weakness profiles reflected
  their weak areas.

The live anonymous browser/API smoke test also passed the repetition check:

- Report:
  `supabase/review/live_assessment_variation_smoke_20260821T131134Z.json`
- OT first questions: 6/6 distinct, 0 repeats.
- NT first questions: 6/6 distinct, 0 repeats.
- OT full session: 20/20 distinct, 0 repeats, spread across all OT sections.
- NT full session: 20/20 distinct, 0 repeats, spread across all NT divisions.

## Current Tooling Note

From this Codex environment on 2026-08-21:

- Before restart, Supabase MCP SQL, Dashboard SQL, and pooler connections were
  failing or timing out while the project showed a resource exhaustion banner.
- A Supabase project restart restored production SQL access.
- The direct Postgres host still may resolve only to IPv6 on some networks.
- The Session pooler worked after restart with the current database password.

## Follow-Up If Results Are Bad

- If OT first-question variation is still too low, move the early seeded
  section/book tie-breakers before section and dimension counts for the first
  one or two questions.
- If duplicates persist, backfill explicit `stem_family`/sibling-family
  metadata for the repeated clusters and keep the runtime similarity key as a
  guardrail.
- If weak areas are under-probed, adjust the router's weak-section follow-up
  thresholds before touching frontend code.
- If BLI scores are implausible, inspect `obs_answer_evidence` and
  `obs_get_bli_scores_v2` before changing display logic.
