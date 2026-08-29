# V7 Long-Run Floor And Section Brake Pass - 2026-08-26

## Purpose

Follow up on the 500-question V7 counterfactual replay by addressing the two
highest-impact remaining routing issues without changing production behavior:

- the low-evidence floor plateaued after about 300 answered questions;
- Latter Prophets still climbed too high over a long run.

No production routing was changed. The live app-facing RPC chain remains V6:

`obs_start_or_resume_ot_assessment_v2 -> obs_get_next_ot_assessment_question -> obs_submit_ot_assessment_response_v2`

Branch: `v7-router-shadow-replay` (`goqgzeipwflwlfnymbaw`)

## Prior Evidence

The previous 500-question V7 replay showed strong safety and novelty behavior:

- 500/500 questions scored;
- 500 distinct questions;
- 0 exact repeats;
- 0 similarity repeats;
- 0 exact chapter-recall rows;
- all depth 4-5 questions had parent evidence.

The main unresolved problems were coverage balance, not crash safety:

- Latter Prophets reached 193/500;
- `law_commands` reached only 35/500;
- `LOW_EVIDENCE_FLOOR` stopped firing after about 300 questions.

## Law Commands Pool Diagnosis

A branch-only synthetic probe with 300 prior non-law answers showed the widened
V6 candidate pool still contained some law material, but only thinly:

- V6 pool total: 79;
- V6 `law_commands`: 6;
- V6 Latter Prophets: 16;
- V7 top pool `law_commands`: 6;
- V7 top pool Latter Prophets: 16;
- V7 top pool `LOW_EVIDENCE_FLOOR`: 3.

Bank-level context:

- total live OT rows: 1,168;
- total `law_commands` rows: 88;
- `law_commands` depth 1-3 rows: 40;
- `law_commands` depth 4-5 rows: 48;
- `law_commands` chapter-addressed rows: 44;
- `law_commands` review-demoted rows: 70.

Interpretation: V7 is not discarding all law candidates, but the available law
pool is small and noisy. The durable fix is probably content/metadata review or
an explicit low-evidence candidate source, not simply forcing every law row into
the top of the router.

## Change Added

Added branch/local migration:

- `supabase/migrations/20260826143400_router_v7_long_run_floor_and_section_brake.sql`
- `supabase/rollback/20260826143400_router_v7_long_run_floor_and_section_brake_rollback.sql`
- `supabase/verify/20260826143400_router_v7_long_run_floor_and_section_brake_verify.sql`

The migration keeps V7 shadow-only and updates
`obs_rank_ot_assessment_candidates_v7`:

- before 200 scored long-run answers:
  - section low-evidence floor remains `< 40`;
  - dimension low-evidence floor remains `< 20`;
- after 200 scored long-run answers:
  - section low-evidence floor rises to `< 80`;
  - dimension low-evidence floor rises to `< 50`;
- after 200 scored long-run answers:
  - non-floor candidates from over-covered sections receive a late section brake
    when section share is above `max(target + 0.05, target * 1.18)`;
  - `LOW_EVIDENCE_FLOOR` keeps priority over that brake.

This preserves the router philosophy: weak and low-evidence areas get more
evidence, but the learner should not be trapped inside one section.

## Branch Verification

The migration was applied only to the V7 branch.

Verifier result:

- `PASS: V7 long-run floor/brake verifier completed under rollback`

The verifier confirmed:

- extended section and dimension floors are installed;
- late long-run section brake marker is installed;
- low-evidence floor still uses long-run totals;
- early section balance remains installed;
- the live next-question RPC still does not call V7;
- displayed BLI still does not call V7 or ladder metadata;
- V7 still returns renderable candidates.

## Targeted Behavior Probe After Patch

After applying the patch, a second synthetic branch-only probe created 300 prior
non-law answers and sampled V7's top pool.

Result:

- V7 pool total: 79;
- `law_commands`: 6;
- Latter Prophets: 16;
- `LOW_EVIDENCE_FLOOR`: 20;
- rows tagged with `late long-run section brake`: 16;
- first `law_commands` rank: 22;
- first `LOW_EVIDENCE_FLOOR` rank: 31.

This is the intended direction:

- the extended low-evidence floor is now visible after 300 answers;
- the late section brake is firing;
- law questions are still available when the upstream pool exposes them.

This probe does not prove the full 300- or 500-question long-run distribution is
fixed. It proves the new guardrails are active and reachable.

## Cleanup

The targeted probe was cleaned immediately after measurement:

- helper table dropped: true;
- synthetic auth users remaining: 0;
- synthetic attempts remaining: 0;
- synthetic answers remaining: 0.

## Recommendation

Do not activate V7 broadly yet.

V7 is much closer: novelty, chapter recall demotion, broad-to-narrow gating, and
weak/strong diagnosis are working. The remaining risk is long-run balance,
especially whether the new floor/brake combination holds up over a full replay.

Recommended next gate:

1. Run a clean 300-question V7 branch replay after this patch.
2. Compare section/dimension distribution against the 500-question report.
3. If Latter Prophets stays near target and `law_commands` rises materially,
   prepare an opt-in V7 activation wrapper.
4. If `law_commands` remains low, do a targeted law metadata/content pass before
   activation.
