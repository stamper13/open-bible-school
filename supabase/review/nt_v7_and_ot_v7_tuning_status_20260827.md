# NT V7 And OT V7 Tuning Status - 2026-08-27

## Scope

Reviewed the active OT V7 app-facing chain and the separate NT assessment
chain:

- OT: `obs_start_or_resume_ot_assessment_v2` ->
  `obs_get_next_ot_assessment_question` ->
  `obs_submit_ot_assessment_response_v2`
- NT: `obs_start_nt_assessment` ->
  `obs_get_next_nt_assessment_question` ->
  `obs_submit_nt_assessment_answer`

Frontend usage still calls those public RPCs directly. No app-facing signature
change is recommended.

Supabase docs check: the 2026-08-27 changelog scan did not show a relevant
breaking change for this Postgres function/migration work. Supabase branching
docs reaffirm that branches are isolated environments and do not copy
production data by default.

## Live OT Diagnosis

Production project: `idyavsqksxtgogpfwlei`

Production is active on `OT_GENERAL.active_version = 'V7'`, but the active V7
ranker is missing the later local branch tuning markers:

- `V7_LOW_EVIDENCE_SUPPLEMENTAL`: absent in production
- `post-150 attempt section cap`: absent in production
- `probe-leave-return section brake`: absent in production

The existing branch `v7-router-shadow-replay` (`goqgzeipwflwlfnymbaw`) has the
supplemental and post-150 cap tuning. A branch-only MCP patch added the new
probe-leave-return ordering brake and the marker verifier passed.

The named live attempt,
`1b862295-9291-4148-b3fb-e10dcd728b3e`, completed 20 questions. Its section
shape confirms the reported behavior:

| Section | Answers |
| --- | ---: |
| Latter Prophets | 11 |
| Writings | 3 |
| Former Prophets | 3 |
| Torah | 3 |

Latter Prophets was sampled across multiple dimensions after misses, so the
router was finding real weakness, but production lacked the later brakes that
would make it leave and return later.

## Latency

Measured on production incomplete OT attempt
`63570f96-ee1a-4053-9ed9-258759879bce`:

| Probe | Time |
| --- | ---: |
| `obs_rank_ot_assessment_candidates_v6` | 1097 ms |
| `obs_rank_ot_assessment_candidates_v7` | 1277 ms |
| `obs_get_next_ot_assessment_question` | 1830 ms |

The app-facing path showed temp reads/writes during the function scan. Current
evidence points to the widened V6/V5/V4 stack and repeated sorting/reranking as
the latency floor; V7 adds a smaller layer on top.

Follow-up live smoke after `20260827113000_router_v7_initial_section_balance`
showed that the initial section-balance wrapper was functionally correct but
too slow: a rollback-only production attempt with six synthetic Latter Prophets
answers returned Torah next, but took about 87 seconds. That slow path came from
repeating the section answer-count subquery for each candidate in the wrapper
order clause.

Added and deployed
`20260827115000_router_v7_initial_section_balance_fast_path.sql` to replace
that recount with `ranked.v7_attempt_section_share`, which the V7 ranker already
returns. The same rollback-only production smoke then returned Torah after six
synthetic Latter Prophets answers in about 3.3 seconds.

`20260827116000_router_v7_use_candidate_facts_cache.sql` was then applied
branch-first and production-next. It rewrites the V7 wrapper and V7 ranker to
read from `obs_router_candidate_facts` instead of expanding
`obs_question_bank_with_dimensions` on the active V7 path. Production verifier
confirmed 1,488 cached valid candidates, no remaining question-bank-view
expansion in the active V7 functions, the fast-path section balance preserved,
and NT unchanged. The same rollback-only oversampled production smoke returned
Torah in about 5.2 seconds after this broader cache substitution.

The real incomplete production attempt used for the earlier timing,
`63570f96-ee1a-4053-9ed9-258759879bce`, still measured about 1.8 seconds through
`obs_get_next_ot_assessment_question` with the owner JWT claim set after the
cache substitution. Direct V7 ranker timing was about 1.64 seconds with no temp
I/O, while the app-facing wrapper still reported temp reads/writes. The
remaining latency is therefore in the wrapper's full selection/filter path, not
in the now-removed question-bank view expansion alone.

## Crash-After-17 Check

Malformed question payloads do not look like the cause:

- OT bank: no missing choices, no non-array choices, no bad sequence rows, no
  missing correct-choice metadata by the live checks.
- NT bank: 319 rows; all have array choices with at least two choices and
  correct-choice metadata.

Existing incomplete OT attempts around 15-18 answered rows can still receive a
next question through the public wrapper when called with the owning user claim.

Most likely cause: transient timeout/load failure in the app-facing get-next
path. That also matches the user report that resume worked. OT already retries
statement timeout once; NT does not. The backend wrapper also correctly falls
back from V7 to V6/V5 if V7 errors or returns no selected row.

## OT Tuning Added Locally

Added:

- `supabase/migrations/20260827112000_router_v7_probe_leave_return_section_brake.sql`
- `supabase/rollback/20260827112000_router_v7_probe_leave_return_section_brake_rollback.sql`
- `supabase/verify/20260827112000_router_v7_probe_leave_return_section_brake_verify.sql`
- `supabase/migrations/20260827113000_router_v7_initial_section_balance.sql`
- `supabase/rollback/20260827113000_router_v7_initial_section_balance_rollback.sql`
- `supabase/verify/20260827113000_router_v7_initial_section_balance_verify.sql`
- `supabase/migrations/20260827115000_router_v7_initial_section_balance_fast_path.sql`
- `supabase/rollback/20260827115000_router_v7_initial_section_balance_fast_path_rollback.sql`
- `supabase/verify/20260827115000_router_v7_initial_section_balance_fast_path_verify.sql`
- `supabase/migrations/20260827116000_router_v7_use_candidate_facts_cache.sql`
- `supabase/rollback/20260827116000_router_v7_use_candidate_facts_cache_rollback.sql`
- `supabase/verify/20260827116000_router_v7_use_candidate_facts_cache_verify.sql`

Behavior:

- For questions 8-39 in an assessment, once a section has supplied at least
  three answers and exceeds `max(35%, target_share + 8%)`, weak-area and
  low-evidence candidates from that section receive an extra ordering penalty.
- This preserves weakness discovery, but discourages a single weak section from
  dominating the first 20-40 questions.
- It is intentionally a brake, not a hard exclusion, so the router can still ask
  that section if alternatives are worse or exhausted.
- The app-facing initial section balance is deployed in production and uses the
  V7 ranker's existing attempt-section share to keep early short assessments
  from hyper-fixing on one weak section.
- The V7 candidate-facts cache migration is deployed in production and removes
  `obs_question_bank_with_dimensions` expansion from the active V7 wrapper and
  ranker paths.

Important production sequencing:

1. Apply the earlier missing ranker-level V7 tuning migrations first:
   - `20260826034112_router_v7_late_low_evidence_floor.sql`
   - `20260826140228_router_v7_low_evidence_floor_long_run_total.sql`
   - `20260826143400_router_v7_long_run_floor_and_section_brake.sql`
   - `20260826172000_router_v7_supplemental_floor_and_attempt_cap.sql`
   - `20260826183000_router_v7_attempt_section_cap_tuning.sql`
2. Then apply `20260827112000_router_v7_probe_leave_return_section_brake.sql`.
3. Run the verifier and a short live smoke before relying on those additional
   ranker-level brakes in production.

## NT V7 Status

The local NT shadow-prep files are still the right starting point:

- `supabase/migrations/20260827110000_nt_router_v7_shadow_prep.sql`
- `supabase/verify/20260827110000_nt_router_v7_shadow_prep_verify.sql`
- `supabase/rollback/20260827110000_nt_router_v7_shadow_prep_rollback.sql`

The migration correctly keeps the app-facing NT RPC untouched and adds a
service-only ranker/log. It accounts for NT differences:

- no event IDs,
- no stem families,
- section/book/dimension brakes,
- early broad foundation,
- chapter/detail demotion,
- Revelation covered by the Apocalypse section and naturally constrained by
  the small bank.

Branch application was not completed in this pass because:

- local `supabase` CLI is not installed;
- no `SUPABASE_DB_URL` / `TARGET_SUPABASE_DB_URL` is present in the shell;
- the Supabase MCP raw-SQL path rejects the full 36 KB function migration
  payload, matching the earlier shadow-prep report.

Do not activate NT V7 until that migration is applied via `psql`/CLI to a
branch, the verifier passes, and a 200+ question NT replay compares current NT
selection against the V7 shadow ranker.

## Assessment Length Recommendation

- 20 questions: keep available as a quick provisional score only.
- 30 questions: recommended default serious baseline after the OT get-next
  stability/latency issue is addressed.
- 40 questions: optional deeper baseline for learners who want a stronger
  first measurement.

Strong recommendations and high-confidence BLI language should remain
evidence-gated. A 20-question run can identify early signals, but it should not
present itself as a settled baseline.

## Verification

Local:

- `npm --prefix web run test:backend-repo`: passed.
- `npm --prefix web run test:migration-chain`: passed after regenerating
  `supabase/review/migration_chain_reconciliation.generated.md`.
- `pglast` parse check passed for the new migration, rollback, and verifier.

Branch:

- Existing branch `goqgzeipwflwlfnymbaw` is project-healthy.
- Probe-leave-return marker check passed after a branch-only MCP patch.
- V7 ranker returned renderable candidates for the verifier probe.
- `router_v7_initial_section_balance` applied and verified.
- `router_v7_initial_section_balance_fast_path` applied and verified.
- `router_v7_use_candidate_facts_cache` applied and verified.
- Rollback-only branch smoke with six synthetic Latter Prophets answers returned
  Torah next in about 4 seconds after the fast path and about 5.1 seconds after
  candidate-facts cache substitution.
- Synthetic branch cleanup checks: 0 `v7-probe-*` users, 0
  `router-v7-verify-*` users, no temp helper visible.
- A no-op MCP migration endpoint probe was removed from branch migration
  history.

Production:

- `router_v7_initial_section_balance` was already present in production
  migration history at version `20260827130336`.
- `router_v7_initial_section_balance_fast_path` was applied to production at
  version `20260827233152`.
- `router_v7_use_candidate_facts_cache` was applied to production at version
  `20260827234652`.
- Verifier passed: OT wrapper has the fast-path marker, uses
  `ranked.v7_attempt_section_share`, the slow correlated recount block is gone,
  the V7 ranker is still called, and NT remained unchanged.
- Candidate-facts verifier passed: wrapper and ranker have the cache marker,
  both use `obs_router_candidate_facts`, neither expands
  `obs_question_bank_with_dimensions`, and the cache has 1,488 valid candidates.
- Rollback-only production smoke with six synthetic Latter Prophets answers
  returned Torah next in about 3.3 seconds. The pre-fast-path version of the
  same smoke returned Torah but took about 87 seconds.
- The same production smoke after candidate-facts cache substitution returned
  Torah next in about 5.2 seconds.
- Real incomplete-attempt timing after candidate-facts cache substitution:
  direct V7 ranker about 1.64 seconds with no temp I/O; app-facing wrapper about
  1.8 seconds and still reporting temp reads/writes.
