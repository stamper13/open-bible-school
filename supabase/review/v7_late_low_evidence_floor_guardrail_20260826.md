# V7 Late Low-Evidence Floor Guardrail - 2026-08-26

## Purpose

Add the next V7 shadow-only guardrail recommended after the 200-question
coverage diagnosis:

- Writings finished at 35/200, below the 40-question section floor.
- `law_commands` finished at 15/200, below the 20-question dimension floor.

The goal is not to make routing rigid. The goal is to prevent important
sections or dimensions from remaining under-evidenced late in a long-run
assessment when enough candidate questions are available.

## Change

Added:

- `supabase/migrations/20260826034112_router_v7_late_low_evidence_floor.sql`
- `supabase/rollback/20260826034112_router_v7_late_low_evidence_floor_rollback.sql`
- `supabase/verify/20260826034112_router_v7_late_low_evidence_floor_verify.sql`

The migration patches `obs_rank_ot_assessment_candidates_v7` only.

Behavior:

- V7 remains shadow-only.
- No app-facing RPC chain changes.
- No BLI/scoring changes.
- Once the learner has at least 80 scored answers, broad/mid candidates can use
  a new `LOW_EVIDENCE_FLOOR` lane if either:
  - that candidate's section has fewer than 40 long-run answers; or
  - that candidate's dimension has fewer than 20 long-run answers.
- The lane is limited to depth 3 or broader.
- The ordering boost is strongest for the biggest evidence deficit.

This means a late assessment can pull Writings or `law_commands` back into view
without jumping into unsupported chapter-level detail.

## Branch Application

Applied to branch only:

- Branch: `v7-router-shadow-replay` (`goqgzeipwflwlfnymbaw`)
- MCP migration name: `router_v7_late_low_evidence_floor`
- Result: success

Production was not changed.

## Verification

Local checks before branch apply:

- `npm --prefix web run test:backend-repo` passed.
- `node scripts/analyze-supabase-migration-chain.mjs --write` completed.
- `npm --prefix web run test:migration-chain` passed.

Branch verifier:

- `20260826034112_router_v7_late_low_evidence_floor_verify.sql` passed under
  rollback.

Verifier confirmed:

- V7 ranker exists.
- `LOW_EVIDENCE_FLOOR` lane is installed.
- lane waits until `scoring_answered >= 80`;
- lane stays broad/mid-level;
- section and dimension floors are present;
- early section balance remains installed;
- live next-question RPC still does not call V7;
- displayed BLI still does not call V7;
- V7 still returns renderable candidates.

## Targeted Behavior Probe

A branch-only synthetic probe created:

- 1 synthetic auth user;
- 1 synthetic OT attempt;
- 80 synthetic answer rows from Torah / Former Prophets / Latter Prophets;
- 0 synthetic Writings history and low `law_commands` history.

Then V7 was asked for the top 25 candidates.

Result:

- `LOW_EVIDENCE_FLOOR` candidates in top 25: 19
- Writings candidates in top 25: 16
- `law_commands` candidates in top 25: 10
- first `LOW_EVIDENCE_FLOOR` rank: 1
- max depth inside `LOW_EVIDENCE_FLOOR`: 3
- narrow candidates inside `LOW_EVIDENCE_FLOOR`: 0

This confirms the guardrail does what it is supposed to do: it pulls
under-evidenced important areas forward late in the run, but does not use the
new lane to force narrow chapter/detail prompts.

## Cleanup

Synthetic probe cleanup audit:

- probe auth users: 0
- probe attempts: 0
- probe answers: 0
- probe snapshots: 0
- probe shadow logs: 0

## Assessment

This is a good launch-safe addition to V7 shadow mode.

It addresses the main remaining issue from the 200-question coverage diagnosis
without changing scoring, production routing, or frontend behavior.

Remaining gate before any V7 activation:

- rerun the full 200-question counterfactual replay with this guardrail applied;
- confirm Writings and `law_commands` rise to target without creating a new
  concentration problem;
- then run one manual/internal V7 smoke where V7 actually drives the assessment
  experience.
