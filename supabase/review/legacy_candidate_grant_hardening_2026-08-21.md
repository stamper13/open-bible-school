# Legacy Candidate Grant Hardening

Generated: 2026-08-21  
Preview branch: `backend-cleanup` (`cwsjtlovatphczdvaimb`)  
Migration: `supabase/migrations/20260821025851_legacy_candidate_rpc_grant_hardening.sql`

## Summary

The first non-destructive Step 4 cleanup batch is prepared and tested on the
preview branch. It revokes `anon` and `authenticated` execute from old
generator/load helpers and `update_theta_from_answer_v1`, while preserving
`service_role` execute for one release.

No production DDL was executed.

## Hardened Functions

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

## Branch Verification

Passed on the preview branch after applying the forward SQL:

- `supabase/verify/20260821025851_legacy_candidate_rpc_grant_hardening_verify.sql`
- `supabase/verify/legacy_candidate_reachability_verify.sql`

Verified effects:

- No hardened function is executable by `anon`.
- No hardened function is executable by `authenticated`.
- Every hardened function remains executable by `service_role`.
- No hardened function is referenced by current public/private function bodies.

## Advisor Result

Supabase security and performance advisors were run after the branch change.
They still report the broader existing backlog:

- security-definer views
- RLS-enabled tables with no policies
- anonymous-access policy warnings
- mutable `search_path` warnings on legacy helper functions
- unindexed foreign keys and unused-index candidates

Those findings predate this cleanup direction and should become later security
and performance batches. The mutable `search_path` warnings remain on several
hardened legacy helpers because this batch intentionally changes grants only,
leaving bodies untouched until the drop/retain decision is made.

## Local Verification

```bash
npm --prefix web run test:rpc-contract
npm --prefix web run test:data-access-contract
npm --prefix web run test:migration-chain
npm --prefix web run test:backend-repo
npm --prefix web run test:unit
bash -n scripts/*.sh
node --check scripts/analyze-supabase-migration-chain.mjs
node --check scripts/check-backend-repo-health.mjs
node --check scripts/check-frontend-direct-data-access.mjs
node --check scripts/check-frontend-rpc-contract.mjs
```

## Next Decision

Let this run as a grant-hardening release before dropping anything. The next
Step 4 proof target should be one of:

- service-role-only NT pilot RPC deprecation/drop proof
- service-role-only credential/printable exam helper product decision
- authenticated-executable legacy selector/recommendation fallback review
