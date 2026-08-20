-- Guarded rollback for 20260820054500_restore_anonymous_transfer_rpcs.sql.
-- Refuses to drop the token table after any transfer capability has been
-- consumed, because that table is then part of the audit trail for moved
-- anonymous progress.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guard$
declare
  v_claimed_count integer := 0;
begin
  if to_regclass('private.obs_anonymous_transfer_tokens') is not null then
    select count(*)
    into v_claimed_count
    from private.obs_anonymous_transfer_tokens
    where claimed_at is not null
      and claimed_by_user_id is not null;

    if v_claimed_count <> 0 then
      raise exception
        'Rollback refused: % anonymous transfer token(s) have been claimed.',
        v_claimed_count;
    end if;
  end if;
end
$guard$;

drop function if exists public.obs_claim_anonymous_transfer(text);
drop function if exists public.obs_issue_anonymous_transfer_token();
drop table if exists private.obs_anonymous_transfer_tokens;

notify pgrst, 'reload schema';

commit;
