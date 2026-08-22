# RPC Contracts

Last reviewed: 2026-08-21  
Verified against: Supabase preview branch `backend-cleanup` (`cwsjtlovatphczdvaimb`)

This document is the human-readable contract registry for database functions that
are app-facing or load-bearing. It complements the generated existence checks in
`supabase/verify/frontend_rpc_contract_verify.sql` and the dependency checks in
`supabase/verify/load_bearing_rpc_chain_verify.sql`.

## Rules

- Do not drop or rename a function in this file without updating the frontend,
  contract verifier, rollback file, and branch verification notes in the same
  change.
- Treat every `SECURITY DEFINER` function as an API endpoint. Review auth checks,
  grants, volatility, and `search_path` before changing it.
- Public or anonymous execute grants are intentional only when called out below.
- Internal delegates are still live if a wrapper or load-bearing verifier reaches
  them, even when frontend grep finds no direct `.rpc()` call.
- New public RPCs should use complete `create or replace function` definitions,
  explicit grants, pinned `search_path`, and companion rollback/verify files.

## Verification Sources

- Frontend source scan: `scripts/check-frontend-rpc-contract.mjs`
- Generated SQL verifier: `supabase/verify/frontend_rpc_contract_verify.sql`
- Load-bearing chain verifier: `supabase/verify/load_bearing_rpc_chain_verify.sql`
- Security-definer grant snapshot:
  `supabase/verify/security_definer_client_surface_verify.sql`
- Source inventory:
  `supabase/review/frontend_backend_usage_inventory_2026-08-20.md`

## Browser Public Reads

These functions are callable by anonymous users. Keep the return shape free of
private user data.

| RPC | Signature | Caller | Volatility | Grants | Notes |
|---|---|---|---|---|---|
| `obs_get_public_question_metadata` | `p_offset integer, p_limit integer` | Knowledge map metadata | `stable` | `anon`, `authenticated`, `service_role` | Public content metadata contract. |
| `obs_get_random_starfield_passage` | no args | Starfield assessment event | `stable` | `anon`, `authenticated`, `service_role` | Public passage/reward experience. |

## Browser Public-Or-Authenticated Reads

These currently allow both anonymous and authenticated execution. They are still
`SECURITY DEFINER`, so the function body must enforce any user-specific privacy
rules itself.

| RPC | Signature | Caller | Volatility | Grants | Notes |
|---|---|---|---|---|---|
| `obs_get_current_focus_path` | `p_user_id uuid` | Focus path UI | `stable` | `anon`, `authenticated`, `service_role` | Review before using for private progress data. |
| `obs_get_ladder_state_v1` | `p_user_id uuid` | Focus path / ladder UI | `stable` | `anon`, `authenticated`, `service_role` | Review ownership checks before widening usage. |
| `obs_get_scope_summary` | `p_user_id uuid, p_scope_type text, p_scope_key text` | Dashboard scope summary | `stable` | `anon`, `authenticated`, `service_role` | Public execute is snapshotted, not a deletion signal. |

## Browser Authenticated Reads

These are called from browser code for signed-in product flows. The current grant
shape is authenticated plus service role, with no anonymous execute grant.

| RPC | Signature | Caller | Volatility | Notes |
|---|---|---|---|---|
| `obs_get_attempt_review` | `p_user_id uuid, p_attempt_id uuid` | Results page | `stable` | Attempt review contract. |
| `obs_get_attempt_summary` | `p_user_id uuid, p_attempt_id uuid` | Results page | `stable` | Attempt summary contract. |
| `obs_get_bli_scores_v2` | `p_user_id uuid` | Dashboard BLI score contract | `stable` | Canonical dashboard BLI scoring surface. |
| `obs_get_bli_section_followup_v1` | `p_user_id uuid, p_testament text` | Dashboard follow-up routing | `stable` | Follow-up recommendation helper. |
| `obs_get_bli_uncertainty` | `p_user_id uuid, p_scope text` | Dashboard and assessment context | `stable` | Assessment uncertainty contract. |
| `obs_get_nt_assessment_status` | `p_attempt_id uuid` | NT assessment startup | `stable` | NT attempt status lookup. |
| `obs_get_progress_history` | `p_user_id uuid, p_testament text, p_limit integer` | Dashboard progress history | `stable` | Progress chart/history. |
| `obs_get_user_recommendation_v2` | `p_user_id uuid` | Dashboard recommendation engine | `volatile` | Current recommendation engine. |

## Browser Authenticated Writes And Repair Paths

These mutate product data and should stay tightly verified. The current grant
shape is authenticated plus service role, with no anonymous execute grant.

| RPC | Signature | Caller | Volatility | Notes |
|---|---|---|---|---|
| `obs_backfill_assessment_snapshots` | `p_user_id uuid` | Progress history repair path | `volatile` | Operational repair path reached by progress history. |
| `obs_claim_anonymous_transfer` | `p_transfer_token text` | Anonymous transfer claim | `volatile` | Claims anonymous progress into an account. |
| `obs_issue_anonymous_transfer_token` | no args | Anonymous transfer token issue | `volatile` | Issues transfer token. |
| `obs_record_study_event` | `p_user_id uuid, p_unit_key text, p_event_type text, p_attempt_id uuid, p_metadata jsonb` | Study/recommendation event logging | `volatile` | Recommendation telemetry. |
| `obs_start_nt_assessment` | `p_section text, p_book_code text, p_target_question_count integer` | NT assessment startup | `volatile` | Starts NT assessment flow. |
| `obs_start_or_resume_ot_assessment_v2` | `p_unit_key text, p_book_code text, p_start_chapter integer, p_end_chapter integer, p_target_question_count integer, p_force_new boolean, p_dimension_key text` | Current OT assessment startup | `volatile` | Current public OT start/resume wrapper. |
| `obs_start_or_resume_ot_scope_assessment` | `p_scope_key text, p_label text, p_target_question_count integer, p_force_new boolean` | Scoped OT assessment startup | `volatile` | Dashboard scoped assessment start. |
| `obs_submit_nt_assessment_answer` | `p_attempt_id uuid, p_generated_question_id uuid, p_selected_choice_id text` | NT answer submission | `volatile` | NT answer submit contract. |
| `obs_submit_ot_assessment_response_v2` | `p_attempt_id uuid, p_generated_question_id uuid, p_response text, p_selected_choice_text text, p_displayed_choices jsonb` | Current OT answer submission | `volatile` | Current OT submit contract. |

## Browser Public-Or-Authenticated Writes

These write-capable functions currently allow anonymous execution. Keep them
documented and snapshotted until a branch migration proves whether anonymous
execution is required.

| RPC | Signature | Caller | Volatility | Review note |
|---|---|---|---|---|
| `obs_skip_broken_assessment_question` | `p_attempt_id uuid, p_generated_question_id uuid, p_error_code text, p_error_message text, p_context jsonb` | Assessment skip/quarantine flow | `volatile` | Review anonymous execution and quarantine side effects before grant cleanup. |
| `obs_submit_section_sort_answers` | `p_attempt_id uuid, p_screen_question_id uuid, p_assignments jsonb` | Section sort answer submission | `volatile` | Review whether anonymous assessment sessions require this grant. |

## Server/Admin Service-Role RPCs

These are called from server routes with the Supabase service role. They should
not be callable by browser roles.

| RPC | Signature | Caller | Volatility | Grants |
|---|---|---|---|---|
| `obs_admin_get_question_quality_queue` | `p_review_status text, p_needs_attention boolean, p_book_code text, p_dimension_key text, p_limit integer, p_offset integer` | Admin question-quality route | `stable` | `service_role` only |
| `obs_admin_set_question_review_status` | `p_generated_question_id uuid, p_review_status text, p_review_notes text` | Admin question-quality route | `volatile` | `service_role` only |

## Internal Delegates

These are not directly called by frontend source, but they are reached by the
load-bearing assessment chain. Do not delete them based on frontend grep.

| Function | Signature | Reached by | Volatility | Grants | Notes |
|---|---|---|---|---|---|
| `obs_get_next_focused_question_v2` | `p_user_id uuid, p_attempt_id uuid, p_unit_key text, p_book_code text, p_start_chapter integer, p_end_chapter integer, p_dimension_key text` | OT question flow | `volatile` | `authenticated`, `service_role` | Exposed delegate; review before tightening. |
| `obs_get_next_ot_assessment_question` | `p_attempt_id uuid` | OT question loader | `volatile` | `authenticated`, `service_role` | Load-bearing wrapper path. |
| `obs_get_next_ot_baseline_question_fast` | `p_attempt_id uuid, p_user_id uuid` | OT selector helper | `stable` | `authenticated`, `service_role` | Fast selector helper. |
| `submit_assessment_answer_v2` | `p_attempt_id uuid, p_user_id uuid, p_generated_question_id uuid, p_selected_choice_id text` | Grader/theta writer | `volatile` | `service_role` only | Internal submit path. |
| `update_theta_internal` | `p_user_id uuid, p_scope text, p_event_id uuid, p_is_correct boolean` | Theta update | `volatile` | `service_role` only | Internal scoring helper. |

## Compatibility Delegates And Legacy-Exposed Helpers

These exist to preserve older wrapper chains or restored behavior. They should be
consolidation candidates only after a branch proves zero reachability.

| Function | Signature | Reached by | Volatility | Grants | Review note |
|---|---|---|---|---|---|
| `obs_start_or_resume_ot_assessment` | `p_unit_key text, p_book_code text, p_start_chapter integer, p_end_chapter integer, p_target_question_count integer, p_force_new boolean` | `obs_start_or_resume_ot_assessment_v2` ordinary OT path | `volatile` | `authenticated`, `service_role` | Restored after cleanup outage; keep until wrapper is simplified. |
| `obs_submit_ot_assessment_answer` | `p_attempt_id uuid, p_generated_question_id uuid, p_selected_choice_id text` | OT submit chain | `volatile` | `authenticated`, `service_role` | Compatibility submit path. |
| `obs_submit_ot_assessment_response` | `p_attempt_id uuid, p_generated_question_id uuid, p_response text` | OT submit chain | `volatile` | `service_role` only | Compatibility delegate. |
| `submit_assessment_answer_v1` | `p_attempt_id uuid, p_user_id uuid, p_generated_question_id uuid, p_selected_choice_id text` | Submit shim | `volatile` | `service_role` only | Candidate for later collapse into v2 path. |
| `get_next_assessment_question` | `p_attempt_id uuid, p_user_id uuid` | OT adaptive selector | `volatile` | `authenticated`, `service_role` | Legacy-exposed selector; verify call graph before revoking. |
| `get_next_scoped_assessment_question` | `p_attempt_id uuid, p_user_id uuid` | Legacy scoped selector | `volatile` | `authenticated`, `service_role` | Suspicious but not safe to drop yet. |

## Near-Term Review Queue

1. Prove whether anonymous execution is still required for
   `obs_skip_broken_assessment_question` and `obs_submit_section_sort_answers`.
2. Prove whether `get_next_assessment_question` and
   `get_next_scoped_assessment_question` can move from authenticated execution
   to service-role/internal-only execution.
3. Add a private account-deletion cleanup RPC before relying on direct fallback
   deletes from the server route.
4. During deletion review, treat `supabase/review/deletion_candidates_2026-08-20.md`
   as the candidate list and this file as the keep-contract list.
