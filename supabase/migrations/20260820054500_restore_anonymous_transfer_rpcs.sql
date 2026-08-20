-- Restore the capability-based anonymous progress transfer RPCs used by
-- web/lib/auth/anonymousTransfer.ts.
--
-- The old public.migrate_anonymous_data(uuid, uuid) function remains as the
-- internal mover, but the frontend must never provide a source user id. These
-- RPCs mint a single-use server-side capability while the caller is still the
-- anonymous user, then derive that source from the token during claim.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $precondition$
begin
  if to_regprocedure('public.migrate_anonymous_data(uuid,uuid)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'migrate_anonymous_data(uuid,uuid) is required before restoring transfer RPCs';
  end if;

  if to_regprocedure('extensions.gen_random_bytes(integer)') is null
     or to_regprocedure('extensions.digest(text,text)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'pgcrypto functions are required before restoring transfer RPCs';
  end if;
end
$precondition$;

create table if not exists private.obs_anonymous_transfer_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  token_hash bytea not null unique,
  source_user_id uuid not null references auth.users(id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  claimed_at timestamptz,
  claimed_by_user_id uuid references auth.users(id),
  constraint obs_anonymous_transfer_tokens_claim_consistency
    check (
      (claimed_at is null and claimed_by_user_id is null)
      or (claimed_at is not null and claimed_by_user_id is not null)
    )
);

create index if not exists obs_anonymous_transfer_tokens_source_open_idx
  on private.obs_anonymous_transfer_tokens (source_user_id, issued_at desc)
  where claimed_at is null;

alter table private.obs_anonymous_transfer_tokens enable row level security;
revoke all on table private.obs_anonymous_transfer_tokens from public, anon, authenticated;

create or replace function public.obs_issue_anonymous_transfer_token()
returns text
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_source_user_id uuid := auth.uid();
  v_source_is_anonymous boolean;
  v_token text;
begin
  if v_source_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'A Supabase session is required to prepare progress transfer';
  end if;

  select user_row.is_anonymous
  into v_source_is_anonymous
  from auth.users user_row
  where user_row.id = v_source_user_id
  for update;

  if not coalesce(v_source_is_anonymous, false) then
    raise exception using
      errcode = '42501',
      message = 'Progress transfer can only be prepared from an anonymous account';
  end if;

  update private.obs_anonymous_transfer_tokens
  set
    claimed_at = now(),
    claimed_by_user_id = v_source_user_id
  where source_user_id = v_source_user_id
    and claimed_at is null;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into private.obs_anonymous_transfer_tokens (
    token_hash,
    source_user_id
  ) values (
    extensions.digest(v_token, 'sha256'),
    v_source_user_id
  );

  return v_token;
end
$function$;

create or replace function public.obs_claim_anonymous_transfer(
  p_transfer_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_destination_user_id uuid := auth.uid();
  v_destination_is_anonymous boolean;
  v_transfer private.obs_anonymous_transfer_tokens%rowtype;
  v_result jsonb;
begin
  if v_destination_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'A signed-in destination session is required';
  end if;

  if nullif(btrim(coalesce(p_transfer_token, '')), '') is null then
    raise exception using
      errcode = '42501',
      message = 'Transfer capability is missing';
  end if;

  select token_row.*
  into v_transfer
  from private.obs_anonymous_transfer_tokens token_row
  where token_row.token_hash = extensions.digest(p_transfer_token, 'sha256')
  for update;

  if not found
     or v_transfer.claimed_at is not null
     or v_transfer.expires_at <= now() then
    raise exception using
      errcode = '42501',
      message = 'Transfer capability is invalid, expired, or already used';
  end if;

  select user_row.is_anonymous
  into v_destination_is_anonymous
  from auth.users user_row
  where user_row.id = v_destination_user_id
  for update;

  if v_destination_is_anonymous is null then
    raise exception using
      errcode = '22023',
      message = 'The destination user does not exist';
  end if;

  if v_destination_is_anonymous then
    raise exception using
      errcode = '42501',
      message = 'The destination must be a registered account';
  end if;

  if v_transfer.source_user_id = v_destination_user_id then
    raise exception using
      errcode = '42501',
      message = 'Transfer source and destination must differ';
  end if;

  v_result := public.migrate_anonymous_data(
    v_transfer.source_user_id,
    v_destination_user_id
  );

  update private.obs_anonymous_transfer_tokens
  set
    claimed_at = now(),
    claimed_by_user_id = v_destination_user_id
  where id = v_transfer.id;

  return coalesce(v_result, jsonb_build_object('ok', true))
    || jsonb_build_object('transferred', true);
end
$function$;

revoke all on function public.obs_issue_anonymous_transfer_token()
  from public, anon;
revoke all on function public.obs_claim_anonymous_transfer(text)
  from public, anon;

grant execute on function public.obs_issue_anonymous_transfer_token()
  to authenticated, service_role;
grant execute on function public.obs_claim_anonymous_transfer(text)
  to authenticated, service_role;

comment on table private.obs_anonymous_transfer_tokens is
  'Single-use hashed capabilities for transferring anonymous progress to a registered account.';
comment on function public.obs_issue_anonymous_transfer_token() is
  'Mints a single-use progress-transfer capability for the current anonymous account.';
comment on function public.obs_claim_anonymous_transfer(text) is
  'Claims anonymous progress using a capability token; the source user is derived server-side.';

notify pgrst, 'reload schema';

commit;
