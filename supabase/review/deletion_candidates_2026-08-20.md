# Deletion and Consolidation Candidates

Generated: 2026-08-20  
Project inspected: `open-bible-school1` (`idyavsqksxtgogpfwlei`)  
Posture: read-only production inspection plus local repo changes only. No production DDL was executed.

## Summary

This is not a drop list. It is the proof register for old OBS surfaces that look removable, lock-downable, or consolidatable.

The strongest low-risk cleanup found today is not a database drop: the account deletion route still carried stale historical table names and a non-updatable view name. That was cleaned locally. A complete account-deletion fix still needs a service-role SQL function because private-schema rows can block `assessment_answers` deletion.

## Evidence Collected

- Frontend RPC contract: 26 `.rpc("...")` names are tracked by `supabase/verify/frontend_rpc_contract_verify.sql`.
- Direct frontend Data API contract: 13 `.from("...")` relation names and 1 reviewed dynamic `.from(table)` site are tracked by `supabase/review/frontend_direct_data_access.generated.md`.
- Live candidate function inventory found 22 public functions in the first suspicious groups.
- Live function-body reference scan found zero public/private functions calling those 22 candidates by name.
- Live trigger scan found zero non-internal triggers using those 22 candidate functions.
- Live account-deletion inspection found `public.obs_answer_evidence` is a non-updatable view, not a table.
- Live FK inspection found `private.bli_answer_scoring_evidence` blocks answer deletion with `ON DELETE RESTRICT`.
- Live FK inspection found `private.obs_anonymous_transfer_tokens.claimed_by_user_id` references `auth.users` without cascade.

## Candidate Function Groups

| Group | Live functions | Frontend calls | Internal function refs | Trigger refs | Current posture |
|---|---:|---:|---:|---:|---|
| Old question generator/load helpers | 11 | 0 | 0 | 0 | Revoke client execute first on a branch; drop only after content tooling replacement is documented. |
| Old NT pilot RPCs | 2 | 0 | 0 | 0 | Already service-role only; likely drop candidate after confirming no manual pilot workflow remains. |
| Credential/printable exam helpers | 4 | 0 | 0 | 0 | Service-role only; product decision needed because credential page is currently roadmap/UI. |
| Older theta helper | 1 | 0 | 0 | 0 | Revoke client execute first; high-value hardening candidate. |
| Older recommendation implementation | 1 | 0 | 0 | 0 | Keep until `obs_get_user_recommendation_v2` delegation is rechecked on a branch. |
| Possible legacy scoped selector | 1 | 0 | 0 | 0 | High caution; check old dashboard scoped assessment flow before revocation/drop. |

## Grant Findings

These candidates are still executable by both `anon` and `authenticated` in production:

- `backfill_questions_from_ot_generated`
- `generate_command_mcq_v1`
- `generate_command_subject_mcq_v1`
- `generate_numeric_mcq_v1`
- `generate_promise_mcq_v1`
- `generate_sequence_adjacent_mcq_v1`
- `generate_sequence_first_mcq_v1`
- `generate_sequence_last_mcq_v1`
- `generate_sequence_order_mcq_v1`
- `generate_speech_mcq_v1`
- `get_mcq_event_entity_v1`
- `load_generated_questions`
- `mcq_pack_v1`
- `update_theta_from_answer_v1`

These candidates are executable by `authenticated` but not `anon`:

- `get_next_scoped_assessment_question`
- `obs_get_user_recommendation_pre_ladder`

These candidates are service-role only:

- `generate_full_exam`
- `mark_exam_generated`
- `nt_get_pilot_questions`
- `nt_submit_pilot_answer`
- `request_custom_exam`
- `submit_exam_results`

## Account Deletion Finding

The route at `web/app/api/account/delete/route.ts` had a stale dynamic table list. The live database showed:

| Name | Live kind | Finding | Local action |
|---|---|---|---|
| `obs_answer_evidence` | view | Non-updatable view over `assessment_answers`; deleting through it is not valid. | Removed from fallback table list. |
| `user_foundation_status` | absent | Earlier OBS-era table name. | Removed from fallback table list. |
| `user_skill_ratings` | absent | Earlier OBS-era table name. | Removed from fallback table list. |
| `obs_20260726_ability_before_answer_eligibility` | absent | Historical analysis table. | Removed from fallback table list. |
| `obs_biblical_taxonomy_ability_backup` | absent | Historical analysis table. | Removed from fallback table list. |
| `obs_biblical_taxonomy_bli_baseline` | absent | Historical analysis table. | Removed from fallback table list. |
| `obs_idk_recompute_before` | absent | Historical analysis table. | Removed from fallback table list. |
| `obs_idk_recompute_old_model` | absent | Historical analysis table. | Removed from fallback table list. |
| `obs_idk_scope_census` | absent | Historical analysis table. | Removed from fallback table list. |

The local fallback list is now limited to existing writable public tables:

- `obs_router_shadow_log`
- `assessment_answers`
- `assessment_attempts`

That fallback is still not the final architecture. A complete cleanup needs `public.obs_delete_account_owned_data(uuid)` or equivalent, because service-role API code cannot safely clear `private.bli_answer_scoring_evidence` through the normal public Data API table loop.

Draft SQL for that future migration is in `supabase/review/account_deletion_cleanup_rpc_draft.sql`.

## Recommended Batch Order

Current Step 4 proof is recorded in
`supabase/review/deletion_proof_register_2026-08-21.md`. The accompanying SQL
guardrail is `supabase/verify/legacy_candidate_reachability_verify.sql`.

1. Account deletion backend fix on a Supabase branch:
   create `public.obs_delete_account_owned_data(uuid)`, revoke from `public`/`anon`/`authenticated`, grant only to `service_role`, then update the route to call the RPC before deleting the auth user.

2. Grant hardening branch:
   revoke `anon`/`authenticated` execute from the old generator/load helpers and `update_theta_from_answer_v1`. Do not drop them in the same batch.

3. Low-risk service-only deprecation branch:
   mark NT pilot and credential helpers deprecated with comments, then wait one release before dropping.

4. Higher-risk compatibility review:
   prove whether `get_next_scoped_assessment_question` and `obs_get_user_recommendation_pre_ladder` are unused by function bodies, old admin/manual scripts, and branch fixtures before any revoke/drop.

5. Final drop batch:
   only after a schema baseline has been captured and restored into a non-production target, and rollback definitions are available from that baseline.

## Verification To Run After Any Future Branch Migration

```bash
npm --prefix web run test:rpc-contract
npm --prefix web run test:data-access-contract
npm --prefix web run test:backend-repo
npm --prefix web run test:unit
```

Then run the Supabase SQL verifiers against the branch target:

- `supabase/verify/frontend_rpc_contract_verify.sql`
- `supabase/verify/frontend_direct_relation_contract_verify.sql`
- `supabase/verify/load_bearing_rpc_chain_verify.sql`
- `supabase/verify/security_definer_client_surface_verify.sql`

## Do Not Drop Yet

- `obs_start_or_resume_ot_assessment`
- `obs_submit_ot_assessment_response`
- `obs_submit_ot_assessment_answer`
- `submit_assessment_answer_v1`
- `submit_assessment_answer_v2`
- `update_theta_internal`
- `get_next_assessment_question`
- `obs_get_next_focused_question_v2`
- `obs_get_next_ot_baseline_question_fast`

These are load-bearing indirect RPCs or compatibility functions protected by existing verifier scripts.
