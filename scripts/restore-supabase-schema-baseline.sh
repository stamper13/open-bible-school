#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
baseline_file="${BASELINE_FILE:-}"
target_db_url="${TARGET_SUPABASE_DB_URL:-}"

if [[ -z "$target_db_url" ]]; then
  echo "ERROR: TARGET_SUPABASE_DB_URL is required." >&2
  echo "Use a non-production Supabase branch/project connection string." >&2
  exit 1
fi

if [[ -z "$baseline_file" ]]; then
  baseline_file="$(find "$repo_root/supabase/baseline" -maxdepth 1 -name '*_production_schema.sql' -type f | sort | tail -n 1)"
fi

if [[ -z "$baseline_file" || ! -f "$baseline_file" ]]; then
  echo "ERROR: BASELINE_FILE was not found." >&2
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
  echo "ERROR: psql is not installed or not on PATH." >&2
  exit 1
fi

echo "About to restore schema baseline:"
echo "  $baseline_file"
echo
echo "This must target a disposable non-production database. It is not for production."
echo "Type RESTORE to continue:"
read -r confirmation

if [[ "$confirmation" != "RESTORE" ]]; then
  echo "Restore cancelled."
  exit 1
fi

"$psql_bin" "$target_db_url" \
  --set ON_ERROR_STOP=1 \
  --file "$baseline_file"

echo "PASS: schema baseline restored to target."
