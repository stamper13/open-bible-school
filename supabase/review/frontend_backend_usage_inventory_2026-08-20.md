# Frontend/backend usage inventory

Generated: 2026-08-20  
Project inspected: `open-bible-school1` (`idyavsqksxtgogpfwlei`)  
Repo inspected: `/Users/stamper35/open-bible-school`  
Posture: read-only against Supabase; documentation-only repo changes.

## Verification run

Passed locally:

```bash
npm --prefix web run test:rpc-contract
npm --prefix web run test:data-access-contract
npm --prefix web run test:backend-repo
```

Results:

- Frontend RPC contract lists 26 RPC names.
- Frontend direct data access contract lists 13 string-literal relation names and 1 reviewed dynamic `.from()` site.
- Backend repo health passed.
- Migration health warning remains: 77 legacy short-version migration files; 57 current 14-digit migration files; 134 migration files total.

## Frontend-called RPCs

These names are called by `.rpc("...")` in `web/app`, `web/lib`, or `web/components` and are protected by `supabase/verify/frontend_rpc_contract_verify.sql`.

| RPC | Observed caller(s) | Notes |
|---|---|---|
| `obs_admin_get_question_quality_queue` | `web/app/api/admin/question-quality/route.ts` | Server/admin route only. |
| `obs_admin_set_question_review_status` | `web/app/api/admin/question-quality/route.ts` | Server/admin route only. |
| `obs_backfill_assessment_snapshots` | `web/app/useProgressHistory.ts` | Operational repair path used by progress history. |
| `obs_claim_anonymous_transfer` | `web/lib/auth/anonymousTransfer.ts` | Guest-to-account progress transfer. |
| `obs_get_attempt_review` | `web/app/results/[attemptId]/page.tsx` | Results screen. |
| `obs_get_attempt_summary` | `web/app/results/[attemptId]/page.tsx` | Results screen. |
| `obs_get_bli_scores_v2` | `web/app/page.tsx` | Canonical BLI score contract. |
| `obs_get_bli_section_followup_v1` | `web/app/page.tsx` | Dashboard follow-up routing. |
| `obs_get_bli_uncertainty` | `web/app/page.tsx`, `web/app/assess/useAssessmentSession.ts` | Dashboard and assessment context. |
| `obs_get_current_focus_path` | `web/lib/focusPath.ts` | Focus path UI. |
| `obs_get_ladder_state_v1` | `web/lib/focusPath.ts` | Focus path / ladder UI. |
| `obs_get_nt_assessment_status` | `web/app/assess/useAssessmentStartup.ts` | NT assessment status. |
| `obs_get_progress_history` | `web/app/useProgressHistory.ts` | Progress chart/history. |
| `obs_get_public_question_metadata` | `web/lib/supabase/questionMetadata.ts` | Knowledge-map metadata. |
| `obs_get_random_starfield_passage` | `web/app/assess/BlackHoleEvent.tsx` | Starfield mini-game. |
| `obs_get_scope_summary` | `web/app/page.tsx` | Dashboard scope summary. |
| `obs_get_user_recommendation_v2` | `web/app/page.tsx` | Current recommendation engine. |
| `obs_issue_anonymous_transfer_token` | `web/lib/auth/anonymousTransfer.ts` | Anonymous transfer. |
| `obs_record_study_event` | `web/app/page.tsx` | Study/recommendation event logging. |
| `obs_skip_broken_assessment_question` | `web/app/assess/useAssessmentAnswerFlow.ts` | Question skip + quarantine flow. |
| `obs_start_nt_assessment` | `web/app/assess/useAssessmentStartup.ts` | NT assessment start. |
| `obs_start_or_resume_ot_assessment_v2` | `web/app/assess/useAssessmentStartup.ts` | Current OT assessment start/resume. |
| `obs_start_or_resume_ot_scope_assessment` | `web/app/assess/useAssessmentStartup.ts` | Dashboard scoped assessment start. |
| `obs_submit_nt_assessment_answer` | `web/app/assess/useAssessmentAnswerFlow.ts` | NT answer submission. |
| `obs_submit_ot_assessment_response_v2` | `web/app/assess/useAssessmentAnswerFlow.ts` | Current OT answer submission. |
| `obs_submit_section_sort_answers` | `web/app/assess/useAssessmentAnswerFlow.ts` | Drag/drop section sort submission. |

## Direct table/view access from frontend/server code

These names are called by `.from("...")` with a string literal.
The generated source of truth for this section is now
`supabase/review/frontend_direct_data_access.generated.md`, with existence
verification in `supabase/verify/frontend_direct_relation_contract_verify.sql`.

| Relation | Caller(s) | Access type | Keep/drop posture |
|---|---|---|---|
| `assessment_answers` | `web/app/page.tsx` | authenticated client read/count | Keep. Dashboard depends on it today. Consider RPC replacement later. |
| `question_reports` | `web/app/assess/useQuestionReport.ts`, `web/app/assess/useAssessmentAnswerFlow.ts` | authenticated client insert | Keep. User-facing report flow. |
| `scripture_books` | `web/app/assess/useNtBookMetadata.ts` | client read | Keep. NT book selector metadata. |
| `obs_reading_log_entries` | `web/lib/readingLog.ts` | authenticated client select/insert | Keep. Reading log feature. |
| `obs_starfield_rewards` | `web/components/StarfieldRewardsLayer.tsx`, `web/app/assess/BlackHoleEvent.tsx` | authenticated client select/insert | Keep. Starfield rewards. |
| `obs_admin_question_bank_audit_summary` | `web/app/api/admin/question-quality/route.ts` | service-role admin read | Keep. Admin route. |
| `obs_admin_assessment_readiness` | `web/app/api/admin/question-quality/route.ts` | service-role admin read | Keep. Admin route. |
| `obs_admin_question_bank_audit` | `web/app/api/admin/question-quality/route.ts` | service-role admin read | Keep. Admin route. |
| `obs_admin_coverage_audit` | `web/app/api/admin/question-quality/route.ts` | service-role admin read | Keep. Admin route. |
| `obs_admin_repetition_audit` | `web/app/api/admin/question-quality/route.ts` | service-role admin read | Keep. Admin route. |
| `obs_admin_difficulty_audit` | `web/app/api/admin/question-quality/route.ts` | service-role admin read | Keep. Admin route. |
| `obs_admin_distractor_audit` | `web/app/api/admin/question-quality/route.ts` | service-role admin read | Keep. Admin route. |
| `obs_admin_malformed_question_reports` | `web/app/api/admin/question-quality/route.ts` | service-role admin read | Keep. Admin route. |

## Dynamic direct access

`web/app/api/account/delete/route.ts` calls `.from(table)` in a loop over `ACCOUNT_DELETION_FALLBACK_TABLES`.
This is not caught by the simple string-literal `.from("...")` inventory.

The generated source of truth for this dynamic call site is now
`supabase/review/frontend_direct_data_access.generated.md`.

Live existence and cleanup check on 2026-08-20:

| Dynamic table name | Exists in production? | Posture |
|---|---:|---|
| `assessment_answers` | yes | Keep in deletion route. |
| `assessment_attempts` | yes | Keep in deletion route. |
| `obs_router_shadow_log` | yes | Keep in deletion route. |
| `obs_answer_evidence` | yes, view | Removed locally; it is a non-updatable view over `assessment_answers`, not a deletable table. |
| `user_foundation_status` | no | Removed locally; stale frontend/backend coupling. |
| `user_skill_ratings` | no | Removed locally; stale frontend/backend coupling. |
| `obs_20260726_ability_before_answer_eligibility` | no | Removed locally; stale historical analysis table reference. |
| `obs_biblical_taxonomy_ability_backup` | no | Removed locally; stale historical analysis table reference. |
| `obs_biblical_taxonomy_bli_baseline` | no | Removed locally; stale historical analysis table reference. |
| `obs_idk_recompute_before` | no | Removed locally; stale historical analysis table reference. |
| `obs_idk_recompute_old_model` | no | Removed locally; stale historical analysis table reference. |
| `obs_idk_scope_census` | no | Removed locally; stale historical analysis table reference. |

The route still needs a branch migration for a complete fix:
`private.bli_answer_scoring_evidence` blocks some `assessment_answers` deletion
with `ON DELETE RESTRICT`, and `private.obs_anonymous_transfer_tokens` has a
non-cascading `claimed_by_user_id` reference. See
`supabase/review/account_deletion_cleanup_rpc_draft.sql`.

## Load-bearing internal RPCs not directly called by frontend

These are not frontend-called by name but should be treated as live until a deeper refactor removes the internal dependency.

| RPC/function | Evidence | Posture |
|---|---|---|
| `obs_start_or_resume_ot_assessment` | `obs_start_or_resume_ot_assessment_v2` delegates to it for the ordinary OT path; restored after 2026-08-18 cleanup. | Keep. |
| `obs_get_next_ot_assessment_question` | Called by assessment loader; delegates deeper to OT router paths. | Keep. |
| `get_next_assessment_question` | Internal OT adaptive selector behind wrapper; verified by load-bearing chain script. | Keep. |
| `obs_submit_ot_assessment_response` | Internal delegate in OT submit chain. | Keep. |
| `obs_submit_ot_assessment_answer` | Internal submit chain. | Keep. |
| `submit_assessment_answer_v1` | Compatibility shim; part of restored submit chain. | Keep until submit chain is intentionally simplified. |
| `submit_assessment_answer_v2` | Internal grader/theta writer behind current submit path. | Keep. |
| `update_theta_internal` | Internal theta update used by submit chain. | Keep. |
| `obs_get_next_focused_question_v2` | Reached from OT question flow, not directly from frontend. | Keep. |
| `obs_get_next_ot_baseline_question_fast` | Reached from OT question flow, not directly from frontend. | Keep. |

Protected by: `supabase/verify/load_bearing_rpc_chain_verify.sql` and `supabase/verify/security_definer_client_surface_verify.sql`.

## First deletion/consolidation candidates

These are candidates only. Do not drop them until the proof column is satisfied on a branch.

| Candidate/group | Why suspicious | Risk | Required proof before action |
|---|---|---:|---|
| `nt_get_pilot_questions`, `nt_submit_pilot_answer` | Earlier NT pilot flow; docs say new flow should not fetch a batch with these. No frontend calls found; client grants already revoked. | Medium | Verify no function-body, trigger, constraint, admin, or manual-script dependency; confirm no planned pilot fallback. |
| `generate_full_exam`, `request_custom_exam`, `mark_exam_generated`, `submit_exam_results` | Credential/printable exam helpers; current credential page is roadmap/UI only, and `submit_exam_results` comment says legacy service-role only. | Medium | Product decision: keep printable assessment roadmap or retire DB helpers; verify no server route or external process calls them. |
| `generate_*_mcq_v1`, `get_mcq_event_entity_v1`, `mcq_pack_v1`, `load_generated_questions`, `backfill_questions_from_ot_generated` | Old generation/load tooling, no frontend calls, broad execute grants on several. | High | Verify operational scripts no longer need them; revoke public/client execute first; only drop after content import replacement exists. |
| `update_theta_from_answer_v1` | Older theta updater; live submit chain uses `update_theta_internal`. Still client-executable per live grants. | High | Verify no current function or manual recompute uses it; revoke client execute first; branch lifecycle tests. |
| `obs_get_user_recommendation_pre_ladder` | Older recommendation implementation; not frontend-called. Security-definer and authenticated-executable. | Medium | Verify `obs_get_user_recommendation_v2` no longer delegates to it before any change. |
| `get_next_scoped_assessment_question` | Not frontend-called; may be legacy scoped selector. Still authenticated-executable. | High | Verify no wrapper, old dashboard flow, or branch-only tests rely on it. |
| Dynamic missing account-deletion table names | Production says several named cleanup tables do not exist, and `obs_answer_evidence` is a non-updatable view. | Low | Initial local cleanup and unit coverage complete; promote private cleanup RPC on a branch. |

## Grant cleanup candidates

Live inspection showed client non-SELECT grants on several objects that are not directly frontend-called or are views. This may be historical grant noise rather than exploitable access, but it should be made boring and explicit.

Examples to review:

- `assessment_attempt_scope_health`
- `question_coverage_status`
- `question_coverage_summary`
- `v_event_importance_current`
- `v_oppressor_mcq_health`
- `v_outline_node_events`
- `obs_map_basemaps`
- reference/content tables such as `bible_events`, `cross_references`, `scripture_books`, `scripture_sections`, `scripture_verses`

Preferred order:

1. Generate a full grants surface report.
2. Revoke broad non-SELECT grants from views/reference tables on a branch.
3. Run frontend, admin route, and Supabase verification scripts.
4. Promote only if no Data API workflows break.

## Next recommended step

Step 1 follow-up: use the generated direct-access artifact when reviewing grant/RLS changes. The next backend branch should promote `supabase/review/account_deletion_cleanup_rpc_draft.sql` into a real migration and then route account deletion through that RPC.
