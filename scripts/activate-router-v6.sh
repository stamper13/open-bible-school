#!/usr/bin/env bash
set -euo pipefail

target_db_url="${TARGET_SUPABASE_DB_URL:-${SUPABASE_DB_URL:-}}"

if [[ -z "$target_db_url" ]]; then
  echo "Set SUPABASE_DB_URL or TARGET_SUPABASE_DB_URL to the verified Supabase branch Postgres URL." >&2
  exit 1
fi

psql_bin="${PSQL_BIN:-}"

if [[ -z "$psql_bin" ]]; then
  if command -v psql >/dev/null 2>&1; then
    psql_bin="$(command -v psql)"
  elif [[ -x /opt/homebrew/opt/libpq/bin/psql ]]; then
    psql_bin="/opt/homebrew/opt/libpq/bin/psql"
  elif [[ -x /usr/local/opt/libpq/bin/psql ]]; then
    psql_bin="/usr/local/opt/libpq/bin/psql"
  fi
fi

if [[ -z "$psql_bin" || ! -x "$psql_bin" ]]; then
  echo "Could not find psql. If installed via Homebrew libpq, run:" >&2
  echo "  export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\"" >&2
  echo "or set PSQL_BIN to the full psql path." >&2
  exit 1
fi

PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-15}" "$psql_bin" "$target_db_url" \
  --set=ON_ERROR_STOP=1 <<'SQL'
begin;

alter table public.obs_router_policy_config
  drop constraint if exists obs_router_policy_version_ck;

alter table public.obs_router_policy_config
  add constraint obs_router_policy_version_ck
  check (
    active_version in ('V3', 'V4', 'V5', 'V6')
    and shadow_version in ('V3', 'V4', 'V5')
    and active_version <> shadow_version
  );

update public.obs_router_policy_config
set active_version = 'V6',
    campaign_enabled = true,
    updated_at = now()
where policy_key = 'OT_GENERAL';

commit;

select policy_key, active_version, campaign_enabled, cold_start_fast_answer_limit
from public.obs_router_policy_config
where policy_key = 'OT_GENERAL';
SQL
