#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sql_file="$repo_root/supabase/diagnostics/question_similarity_duplicate_audit.sql"
report_dir="$repo_root/supabase/review"
report_file="$report_dir/question_similarity_duplicate_audit_$(date -u +%Y%m%d%H%M%S).txt"
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

mkdir -p "$report_dir"

PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-15}" "$psql_bin" "$target_db_url" \
  --set=ON_ERROR_STOP=1 \
  --file="$sql_file" | tee "$report_file"

echo "Wrote $report_file"
