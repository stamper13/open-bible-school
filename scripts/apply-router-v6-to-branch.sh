#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target_db_url="${TARGET_SUPABASE_DB_URL:-${SUPABASE_DB_URL:-}}"

if [[ -z "$target_db_url" ]]; then
  echo "Set SUPABASE_DB_URL or TARGET_SUPABASE_DB_URL to the Supabase branch Postgres URL." >&2
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

migrations=(
  "supabase/migrations/20260822140000_router_v6_01_evidence_ledger.sql"
  "supabase/migrations/20260822140100_router_v6_02_reread_mark.sql"
  "supabase/migrations/20260822140200_router_v6_03_campaign_state.sql"
  "supabase/migrations/20260822140300_router_v6_04_mode_and_campaign.sql"
  "supabase/migrations/20260822140400_router_v6_05_rank_candidates.sql"
  "supabase/migrations/20260822140500_router_v6_06_activate.sql"
  "supabase/migrations/20260822140600_router_v6_07_reconcile_mode_with_evidence_floor.sql"
  "supabase/migrations/20260822140700_router_v6_08_dimension_precedence.sql"
  "supabase/migrations/20260822140800_router_v6_09_policy_version_constraint.sql"
)

for migration in "${migrations[@]}"; do
  migration_path="$repo_root/$migration"
  if [[ ! -f "$migration_path" ]]; then
    echo "Missing migration: $migration" >&2
    exit 1
  fi

  echo "Applying $migration"
  PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-15}" "$psql_bin" "$target_db_url" \
    --set=ON_ERROR_STOP=1 \
    --file="$migration_path"
done

echo "Running supabase/verify/20260822_router_v6_verify.sql"
PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-15}" "$psql_bin" "$target_db_url" \
  --set=ON_ERROR_STOP=1 \
  --file="$repo_root/supabase/verify/20260822_router_v6_verify.sql"

echo "PASS: router v6 migrations applied and verified while still inactive."
echo "Next: run simulations, then activate with scripts/activate-router-v6.sh if they pass."
