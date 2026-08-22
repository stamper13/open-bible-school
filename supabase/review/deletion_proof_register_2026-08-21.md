# Deletion Proof Register

Generated: 2026-08-21  
Verified against: Supabase preview branch `backend-cleanup` (`cwsjtlovatphczdvaimb`)  
Posture: read-only branch inspection plus repository guardrails. No production DDL was executed.

## Purpose

This is the Step 4 proof register for the first legacy/deletion candidate set.
It separates three different ideas that are easy to accidentally merge:

- no current frontend/server code reference
- no current database reachability through function bodies or triggers
- safe to revoke/drop

The first two are now evidenced for the candidate set below. The third still
requires branch migrations, verification, and product decisions where noted.

## Candidate Groups

| Group | Candidate count | Frontend/server refs | Current DB function-body refs | Trigger refs | Current action |
|---|---:|---:|---:|---:|---|
| Old question generator/load helpers | 13 | 0 | 0 | 0 | Revoke `anon`/`authenticated` execute first; do not drop yet. |
| Older theta helper | 1 | 0 | 0 | 0 | Revoke `anon`/`authenticated` execute first; current submit chain uses `update_theta_internal`. |
| Old NT pilot RPCs | 2 | 0 | 0 | 0 | Already service-role only; candidate for deprecation comment, then later drop. |
| Credential/printable exam helpers | 4 | 0 | 0 | 0 | Already service-role only; product decision needed before drop. |
| Older recommendation implementation | 1 | 0 | 0 | 0 | Authenticated-executable; revoke only after confirming no planned fallback. |
| Possible legacy scoped selector | 1 | 0 | 0 | 0 | Authenticated-executable; high caution because assessment routing is load-bearing. |

## Exact Candidate Signatures And Grants

| Function | Signature | Current grants | Posture |
|---|---|---|---|
| `backfill_questions_from_ot_generated` | `p_question_type text, p_limit integer` | `anon`, `authenticated`, `service_role` | Old generator/load helper; revoke client execute first. |
| `generate_command_mcq_v1` | `p_book_code text, p_limit integer` | `anon`, `authenticated`, `service_role` | Old generator/load helper; revoke client execute first. |
| `generate_command_subject_mcq_v1` | `p_book_code text, p_limit integer` | `anon`, `authenticated`, `service_role` | Old generator/load helper; revoke client execute first. |
| `generate_numeric_mcq_v1` | `p_book_code text, p_outline_slug text, p_limit integer` | `anon`, `authenticated`, `service_role` | Old generator/load helper; revoke client execute first. |
| `generate_promise_mcq_v1` | `p_limit integer` | `anon`, `authenticated`, `service_role` | Old generator/load helper; revoke client execute first. |
| `generate_sequence_adjacent_mcq_v1` | `p_book_code text, p_limit integer` | `anon`, `authenticated`, `service_role` | Old generator/load helper; revoke client execute first. |
| `generate_sequence_first_mcq_v1` | `p_book_code text, p_limit integer` | `anon`, `authenticated`, `service_role` | Old generator/load helper; revoke client execute first. |
| `generate_sequence_last_mcq_v1` | `p_book_code text, p_limit integer` | `anon`, `authenticated`, `service_role` | Old generator/load helper; revoke client execute first. |
| `generate_sequence_order_mcq_v1` | `p_book_code text, p_limit integer` | `anon`, `authenticated`, `service_role` | Old generator/load helper; revoke client execute first. |
| `generate_speech_mcq_v1` | `p_speech_kind text, p_book_code text, p_limit integer` | `anon`, `authenticated`, `service_role` | Old generator/load helper; revoke client execute first. |
| `get_mcq_event_entity_v1` | `p_book_code text, p_choices integer` | `anon`, `authenticated`, `service_role` | Old generator/load helper; revoke client execute first. |
| `load_generated_questions` | `p_question_type text, p_template_id text, p_default_difficulty integer, p_default_detail_level text, p_default_dispute_risk text` | `anon`, `authenticated`, `service_role` | Old generator/load helper; revoke client execute first. |
| `mcq_pack_v1` | `p_prompt text, p_correct_entity_id uuid, p_correct_text text, p_distractors jsonb, p_choices integer` | `anon`, `authenticated`, `service_role` | Old generator/load helper; revoke client execute first. |
| `update_theta_from_answer_v1` | `p_user_id uuid, p_scope text, p_event_id uuid, p_is_correct boolean` | `anon`, `authenticated`, `service_role` | Older theta helper; revoke client execute first. |
| `nt_get_pilot_questions` | `p_section text, p_book_code text, p_limit integer` | `service_role` | Old NT pilot RPC; later deprecation/drop candidate. |
| `nt_submit_pilot_answer` | `p_generated_question_id uuid, p_selected_choice_id text` | `service_role` | Old NT pilot RPC; later deprecation/drop candidate. |
| `generate_full_exam` | no args | `service_role` | Credential helper; product decision before drop. |
| `request_custom_exam` | `p_candidate_name text` | `service_role` | Credential helper; product decision before drop. |
| `mark_exam_generated` | `p_token uuid` | `service_role` | Credential helper; product decision before drop. |
| `submit_exam_results` | `p_token uuid, p_results jsonb` | `service_role` | Credential helper; product decision before drop. |
| `obs_get_user_recommendation_pre_ladder` | `p_user_id uuid` | `authenticated`, `service_role` | Older recommendation implementation; review fallback before revoke/drop. |
| `get_next_scoped_assessment_question` | `p_attempt_id uuid, p_user_id uuid` | `authenticated`, `service_role` | Legacy scoped selector; high caution. |

## New Verifier

`supabase/verify/legacy_candidate_reachability_verify.sql` now checks:

- no candidate is referenced by current public/private function bodies
- no candidate is attached to a non-internal trigger
- service-only candidates are not executable by `anon` or `authenticated`
- client-executable candidates are surfaced as a notice for grant review

The verifier is included in `scripts/run-supabase-sql-verifiers.sh` and required
by `scripts/check-backend-repo-health.mjs`.

## Next Branch Batch

Prepared migration:
`supabase/migrations/20260821025851_legacy_candidate_rpc_grant_hardening.sql`.
Branch application and verification are recorded in
`supabase/review/legacy_candidate_grant_hardening_2026-08-21.md`.

The next migration is non-destructive grant hardening only:

1. Revoke `anon` and `authenticated` execute from the old generator/load helper
   group and `update_theta_from_answer_v1`.
2. Keep `service_role` execute for one release so manual tooling can still be
   recovered if needed.
3. Run the full SQL verifier suite and frontend unit/contract gates.
4. Record whether any manual content-generation workflow still needs these
   helpers before preparing a later drop migration.

Do not drop `obs_get_user_recommendation_pre_ladder` or
`get_next_scoped_assessment_question` in that batch. They need a separate
assessment/recommendation fallback decision.
