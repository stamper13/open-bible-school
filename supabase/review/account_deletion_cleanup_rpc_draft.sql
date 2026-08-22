-- Draft only. Do not apply directly to production.
--
-- Promote this into a timestamped migration with `supabase migration new` after
-- the Supabase CLI is available or a Supabase branch has been created.
--
-- Purpose:
--   Centralize account-owned data deletion inside Postgres so service-role API
--   code can clean both public and private schema rows before deleting auth.users.
--
-- Live production findings on 2026-08-20:
--   - public.obs_answer_evidence is a non-updatable view over assessment_answers.
--   - private.bli_answer_scoring_evidence references assessment_answers with
--     ON DELETE RESTRICT, so assessment_answers cannot always be deleted first.
--   - private.obs_anonymous_transfer_tokens.claimed_by_user_id references
--     auth.users without ON DELETE CASCADE.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.obs_delete_account_owned_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_counts jsonb := '{}'::jsonb;
  v_count bigint;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required' using errcode = '22023';
  end if;

  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  delete from private.obs_anonymous_transfer_tokens
  where source_user_id = p_user_id
     or claimed_by_user_id = p_user_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('private.obs_anonymous_transfer_tokens', v_count);

  delete from private.bli_answer_scoring_evidence
  where user_id = p_user_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('private.bli_answer_scoring_evidence', v_count);

  delete from public.obs_router_shadow_log
  where user_id = p_user_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('public.obs_router_shadow_log', v_count);

  delete from public.assessment_answers
  where user_id = p_user_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('public.assessment_answers', v_count);

  delete from public.assessment_attempts
  where user_id = p_user_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('public.assessment_attempts', v_count);

  return v_counts;
end;
$$;

revoke all on function public.obs_delete_account_owned_data(uuid) from public;
revoke execute on function public.obs_delete_account_owned_data(uuid) from anon;
revoke execute on function public.obs_delete_account_owned_data(uuid) from authenticated;
grant execute on function public.obs_delete_account_owned_data(uuid) to service_role;

comment on function public.obs_delete_account_owned_data(uuid) is
  'Service-role-only account deletion helper. Deletes private scoring evidence and non-cascading public rows before auth.users deletion.';

commit;
