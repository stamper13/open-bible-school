#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

target_db_url="${TARGET_SUPABASE_DB_URL:-${SUPABASE_DB_URL:-}}"

if [[ -z "$target_db_url" ]]; then
  echo "ERROR: TARGET_SUPABASE_DB_URL or SUPABASE_DB_URL is required." >&2
  echo "Use an uncommitted connection string for a branch or restored non-production database." >&2
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
  echo "If installed via Homebrew libpq, run:" >&2
  echo "  export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\"" >&2
  echo "or set PSQL_BIN to the full psql path." >&2
  exit 1
fi

verifiers=(
  "supabase/verify/frontend_rpc_contract_verify.sql"
  "supabase/verify/frontend_direct_relation_contract_verify.sql"
  "supabase/verify/load_bearing_rpc_chain_verify.sql"
  "supabase/verify/security_definer_client_surface_verify.sql"
  "supabase/verify/legacy_candidate_reachability_verify.sql"
)

for verifier in "${verifiers[@]}"; do
  verifier_path="$repo_root/$verifier"
  if [[ ! -f "$verifier_path" ]]; then
    echo "ERROR: missing verifier: $verifier" >&2
    exit 1
  fi

  echo "Running $verifier"
  "$psql_bin" "$target_db_url" \
    --set ON_ERROR_STOP=1 \
    --quiet \
    --file "$verifier_path"
done

echo "PASS: Supabase SQL verifier suite completed."
