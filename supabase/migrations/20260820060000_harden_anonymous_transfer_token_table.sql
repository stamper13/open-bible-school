-- Make the anonymous-transfer token table's direct-access posture explicit
-- and add the covering index Supabase's performance advisor expects for the
-- claimed_by_user_id foreign key.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create index if not exists obs_anonymous_transfer_tokens_claimed_by_idx
  on private.obs_anonymous_transfer_tokens (claimed_by_user_id)
  where claimed_by_user_id is not null;

drop policy if exists obs_anonymous_transfer_tokens_no_anon_access
  on private.obs_anonymous_transfer_tokens;
drop policy if exists obs_anonymous_transfer_tokens_no_authenticated_access
  on private.obs_anonymous_transfer_tokens;

create policy obs_anonymous_transfer_tokens_no_anon_access
  on private.obs_anonymous_transfer_tokens
  as restrictive
  for all
  to anon
  using (false)
  with check (false);

create policy obs_anonymous_transfer_tokens_no_authenticated_access
  on private.obs_anonymous_transfer_tokens
  as restrictive
  for all
  to authenticated
  using (false)
  with check (false);

commit;
