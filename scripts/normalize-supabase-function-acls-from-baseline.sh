#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
baseline_file="${BASELINE_FILE:-}"
target_db_url="${TARGET_SUPABASE_DB_URL:-${SUPABASE_DB_URL:-}}"
production_project_ref="${PRODUCTION_SUPABASE_PROJECT_REF:-idyavsqksxtgogpfwlei}"

if [[ -z "$target_db_url" ]]; then
  echo "ERROR: TARGET_SUPABASE_DB_URL or SUPABASE_DB_URL is required." >&2
  exit 1
fi

if [[ "$target_db_url" == *"$production_project_ref"* ]]; then
  echo "ERROR: target URL appears to reference production project $production_project_ref." >&2
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

acl_file="$(mktemp)"
cleanup() {
  rm -f "$acl_file"
}
trap cleanup EXIT

{
  echo "revoke execute on all functions in schema private from anon, authenticated, service_role;"
  echo "revoke execute on all functions in schema public from anon, authenticated, service_role;"
  awk '/^(REVOKE|GRANT) .* ON FUNCTION / { print }' "$baseline_file"
} >"$acl_file"

"$psql_bin" "$target_db_url" \
  --single-transaction \
  --set ON_ERROR_STOP=1 \
  --file "$acl_file"

echo "PASS: function ACLs normalized from schema baseline."
