# Direct Data API Access

Last reviewed: 2026-08-21  
Verified against: Supabase preview branch `backend-cleanup` (`cwsjtlovatphczdvaimb`)

This document records intentional `.from(...)` usage from `web/app`, `web/lib`,
and `web/components`. It complements the generated source inventory in
`supabase/review/frontend_direct_data_access.generated.md` and the relation
existence verifier in `supabase/verify/frontend_direct_relation_contract_verify.sql`.

## Rules

- Prefer RPCs for workflows that combine authorization, writes, private-schema
  cleanup, or multiple relations.
- Keep direct browser access only when the relation has a clear RLS/policy model.
- Server/admin reads may use the service role, but admin-only views should not
  rely on broad public grants.
- Dynamic `.from(table)` usage must stay allowlisted in
  `scripts/check-frontend-direct-data-access.mjs`.
- Do not delete a relation from this file without updating frontend callers and
  regenerating the direct-access verifier.

## Browser Client Relations

| Relation | Operation | Caller | Intended model | Current branch posture | Notes |
|---|---|---|---|---|---|
| `assessment_answers` | `select` count | `web/app/page.tsx` | Authenticated dashboard count | Table, RLS enabled, 1 policy; broad role grants are present | Keep now. Good candidate to replace with a small dashboard RPC. |
| `question_reports` | `insert` | `web/app/assess/useAssessmentAnswerFlow.ts`, `web/app/assess/useQuestionReport.ts` | Authenticated report submission | Table, RLS enabled, 2 policies; broad role grants are present | Keep. Confirm policy limits inserts to the acting user/attempt. |
| `scripture_books` | `select` | `web/app/assess/useNtBookMetadata.ts` | Public/content metadata read | Table, RLS enabled, 1 policy; broad role grants are present | Keep as public metadata unless moved behind metadata RPC. |
| `obs_reading_log_entries` | `select`, `insert` | `web/lib/readingLog.ts` | Authenticated user reading log | Table, RLS enabled, 2 policies; broad role grants are present | Keep. Review delete/update grants separately. |
| `obs_starfield_rewards` | `select`, `insert` | `web/app/assess/BlackHoleEvent.tsx`, `web/components/StarfieldRewardsLayer.tsx` | Authenticated rewards read/write | Table, RLS enabled, 2 policies; broad role grants are present | Keep. Review anonymous and delete grants separately. |

## Server/Admin Service-Role Relations

These are read through the admin route with a service-role client. They are
product-critical for question-bank QA, but should behave as admin-only surfaces.

| Relation | Operation | Caller | Current branch posture | Notes |
|---|---|---|---|---|
| `obs_admin_question_bank_audit_summary` | `select` | `web/app/api/admin/question-quality/route.ts` | View; broad role grants are present | Review for explicit service-role-only grants or move behind admin RPC. |
| `obs_admin_assessment_readiness` | `select` | `web/app/api/admin/question-quality/route.ts` | View; broad role grants are present | Review because views can bypass table RLS unless designed otherwise. |
| `obs_admin_question_bank_audit` | `select` | `web/app/api/admin/question-quality/route.ts` | View; broad role grants are present | Keep for admin route; tighten grants in security phase. |
| `obs_admin_coverage_audit` | `select` | `web/app/api/admin/question-quality/route.ts` | View; broad role grants are present | Keep for admin route; tighten grants in security phase. |
| `obs_admin_repetition_audit` | `select` | `web/app/api/admin/question-quality/route.ts` | View; broad role grants are present | Keep for admin route; tighten grants in security phase. |
| `obs_admin_difficulty_audit` | `select` | `web/app/api/admin/question-quality/route.ts` | View; broad role grants are present | Keep for admin route; tighten grants in security phase. |
| `obs_admin_distractor_audit` | `select` | `web/app/api/admin/question-quality/route.ts` | View; broad role grants are present | Keep for admin route; tighten grants in security phase. |
| `obs_admin_malformed_question_reports` | `select` | `web/app/api/admin/question-quality/route.ts` | View; broad role grants are present | Keep for admin route; tighten grants in security phase. |

## Dynamic Account Deletion Fallback

`web/app/api/account/delete/route.ts` intentionally uses `.from(table)` in a loop
over `ACCOUNT_DELETION_FALLBACK_TABLES`. The current allowlisted relation names
are:

| Relation | Operation | Reason | Notes |
|---|---|---|---|
| `obs_router_shadow_log` | `delete` | Account-owned cleanup fallback | Table has RLS enabled but no policies in the branch snapshot. Use service role only. |
| `assessment_answers` | `delete` | Account-owned cleanup fallback | Deletion can be blocked by private-schema references; move this into a private RPC. |
| `assessment_attempts` | `delete` | Account-owned cleanup fallback | Keep until private account deletion RPC owns the full cascade. |

Stale historical cleanup names were removed from the local route after live
verification. `obs_answer_evidence` was also removed from the route because it is
a non-updatable view over `assessment_answers`, not a deletable table.

## Branch Grant Snapshot

The preview branch showed broad role grants on all direct browser tables and
admin views in this registry. That does not mean every row is exposed, because
RLS policies can still restrict table access. It does mean the grant surface is
harder to reason about than it should be.

Priority cleanup order:

1. Move account-owned delete cleanup into a reviewed private RPC.
2. Replace `assessment_answers` direct dashboard count with an RPC.
3. Tighten admin audit views to service-role-only or replace them with admin RPCs.
4. Review browser table grants so exposed operations match actual caller usage:
   select/insert where needed, no broad delete/update grants unless proven.

## Verification Commands

```bash
node scripts/check-frontend-direct-data-access.mjs --write
npm --prefix web run test:data-access-contract
```
