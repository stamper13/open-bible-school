# Backend Features Deployment

Run these files in the Supabase SQL editor in this exact order:

1. `supabase/migrations/20260722_distractor_difficulty_dial.sql`
2. `supabase/migrations/20260723_assessment_insights_backend.sql`
3. `supabase/migrations/20260723_question_quality_console.sql`
4. `supabase/migrations/20260723_nt_persistent_adaptive.sql`
5. `supabase/migrations/20260723_backend_features_verify.sql`

If the distractor-difficulty migration has already been applied successfully,
start at step 2. Each installation migration uses a transaction, so a failure
rolls back that file rather than leaving it half installed.

The verification file is read-only. Its last result should say:

`PASS: backend feature objects, privileges, and dependencies are present`

Do not run `20260723_backend_features_rollback.sql` during installation. It is
only for intentionally removing this feature package.

## Existing Learners

Snapshots are created automatically for new answers. Existing attempt history
can be backfilled after deployment by an authenticated user:

```sql
select public.obs_backfill_assessment_snapshots(auth.uid());
```

The frontend handoff calls this RPC only when progress history is empty, so it
does not need to be run manually for every account.

## Security

Learner RPCs verify that the requested user matches `auth.uid()`. Supabase
anonymous-auth users count as authenticated sessions and are supported.

Question-quality views and mutation RPCs are granted only to `service_role`.
Never add the service-role key to a `NEXT_PUBLIC_*` environment variable or
browser bundle.

## Rollback

`supabase/migrations/20260723_backend_features_rollback.sql` restores question
types quarantined through the new review console, then removes the new tables,
views, triggers, and RPCs. It preserves the additive columns on
`assessment_attempts` to avoid deleting attempt metadata.
