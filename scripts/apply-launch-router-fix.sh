#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migration_file="$repo_root/supabase/migrations/20260821125302_diversify_ot_baseline_fast_selector.sql"
verify_file="$repo_root/supabase/verify/20260821125302_diversify_ot_baseline_fast_selector_verify.sql"
target_db_url="${TARGET_SUPABASE_DB_URL:-${SUPABASE_DB_URL:-}}"

if [[ -z "$target_db_url" ]]; then
  echo "Set SUPABASE_DB_URL or TARGET_SUPABASE_DB_URL to the target Postgres connection string." >&2
  exit 1
fi

psql_bin=""

if command -v psql >/dev/null 2>&1; then
  psql_bin="$(command -v psql)"
elif [[ -x /opt/homebrew/opt/libpq/bin/psql ]]; then
  psql_bin="/opt/homebrew/opt/libpq/bin/psql"
fi

if [[ -z "$psql_bin" || ! -x "$psql_bin" ]]; then
  echo "Could not find psql. Install libpq or add psql to PATH." >&2
  exit 1
fi

if PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-15}" "$psql_bin" "$target_db_url" \
  --set=ON_ERROR_STOP=1 \
  --file="$verify_file" >/dev/null 2>&1; then
  echo "Launch router fix is already applied and verified."
  exit 0
fi

PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-15}" "$psql_bin" "$target_db_url" \
  --set=ON_ERROR_STOP=1 \
  --file="$migration_file"

PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-15}" "$psql_bin" "$target_db_url" \
  --set=ON_ERROR_STOP=1 \
  --file="$verify_file"
