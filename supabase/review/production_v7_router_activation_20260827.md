# Production V7 Router Activation - 2026-08-27

## Summary

V7 is now active for adaptive OT assessment routing in production.

The public app-facing RPC chain remains unchanged:

`obs_start_or_resume_ot_assessment_v2 -> obs_get_next_ot_assessment_question -> obs_submit_ot_assessment_response_v2`

The activation happens inside `get_next_assessment_question`, which is called by
`obs_get_next_ot_assessment_question` for `ot_adaptive` attempts.

## Migrations Applied

Applied to branch `v7-router-shadow-replay` (`goqgzeipwflwlfnymbaw`) and
production (`idyavsqksxtgogpfwlei`):

- `supabase/migrations/20260827100000_router_v7_activate.sql`
- `supabase/migrations/20260827101000_router_v7_activation_record_guard.sql`

Companions:

- `supabase/rollback/20260827100000_router_v7_activate_rollback.sql`
- `supabase/rollback/20260827101000_router_v7_activation_record_guard_rollback.sql`
- `supabase/verify/20260827100000_router_v7_activate_verify.sql`
- `supabase/verify/20260827101000_router_v7_activation_record_guard_verify.sql`

## Behavior

When `obs_router_policy_config.active_version = 'V7'`:

- the normal opening fast selector still runs for the configured first 4
  scoring-eligible cold-start answers;
- after that, or when the fast selector is bypassed, the app-facing adaptive
  path tries `obs_rank_ot_assessment_candidates_v7` first;
- if V7 errors or returns no usable candidate, the selector falls back to the
  existing V6/V5 path;
- submit/scoring behavior is unchanged.

Production policy after activation:

- `active_version = 'V7'`
- `cold_start_fast_answer_limit = 4`

## Verification

Local gates passed:

- `npm --prefix web run test:backend-repo`
- `npm --prefix web run test:migration-chain`

Branch checks passed:

- activation migration applied;
- record-guard migration applied;
- policy is V7;
- selector body contains V7 activation and record guard;
- with `cold_start_fast_answer_limit = 0` inside a rollback transaction, the
  public app-facing next-question RPC returned exactly the top V7 candidate;
- manual V6 policy toggle inside a rollback transaction still returned a
  question;
- no synthetic smoke users remained.

Production checks passed:

- policy is V7;
- selector body contains V7 activation and record guard;
- with `cold_start_fast_answer_limit = 0` inside a rollback transaction, the
  public app-facing next-question RPC returned exactly the top V7 candidate;
- the returned app-facing question had 4 choices;
- manual V6 policy toggle inside a rollback transaction still returned a
  question;
- synthetic smoke users remaining: 0.

## Rollback

Primary rollback:

1. Run `supabase/rollback/20260827101000_router_v7_activation_record_guard_rollback.sql`
2. Run `supabase/rollback/20260827100000_router_v7_activate_rollback.sql`

Emergency policy lever if a full rollback is not immediately available:

```sql
update public.obs_router_policy_config
set active_version = 'V6',
    updated_at = now()
where policy_key = 'OT_GENERAL';
```

The record guard was added so this policy-only toggle still returns questions.
