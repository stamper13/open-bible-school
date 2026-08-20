begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop policy if exists obs_anonymous_transfer_tokens_no_anon_access
  on private.obs_anonymous_transfer_tokens;
drop policy if exists obs_anonymous_transfer_tokens_no_authenticated_access
  on private.obs_anonymous_transfer_tokens;

drop index if exists private.obs_anonymous_transfer_tokens_claimed_by_idx;

commit;
