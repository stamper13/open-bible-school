#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

run_sql_file() {
  local label="$1"
  local file="$2"

  echo ""
  echo "=== ${label} ==="
  PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-15}" "$psql_bin" "$target_db_url" \
    --set=ON_ERROR_STOP=1 \
    --file="$file"
}

run_script() {
  local label="$1"
  shift

  echo ""
  echo "=== ${label} ==="
  "$@"
}

run_sql_file \
  "Verify OT fast-selector diversification" \
  "$repo_root/supabase/verify/20260821125302_diversify_ot_baseline_fast_selector_verify.sql"

run_sql_file \
  "Verify NT question-bank view optimization" \
  "$repo_root/supabase/verify/20260821130414_optimize_nt_question_bank_view_verify.sql"

run_sql_file \
  "Verify NT router balance" \
  "$repo_root/supabase/verify/20260821130849_balance_nt_assessment_router_verify.sql"

run_sql_file \
  "Verify NT attempt summary sync" \
  "$repo_root/supabase/verify/20260821134530_sync_nt_attempt_summary_on_submit_verify.sql"

run_sql_file \
  "Verify NT attempt summary backfill" \
  "$repo_root/supabase/verify/20260821135405_backfill_nt_attempt_summary_counts_verify.sql"

run_script \
  "Run synthetic OT/NT profile simulation" \
  env \
    SUPABASE_DB_URL="$target_db_url" \
    LAUNCH_TESTAMENT="${LAUNCH_TESTAMENT:-ALL}" \
    LAUNCH_QUESTION_COUNT="${LAUNCH_QUESTION_COUNT:-12}" \
    LAUNCH_RUN_COUNT="${LAUNCH_RUN_COUNT:-1}" \
    LAUNCH_STATEMENT_TIMEOUT="${LAUNCH_STATEMENT_TIMEOUT:-180s}" \
    "$repo_root/scripts/run-launch-assessment-simulation.sh"

if [[ "${RUN_LIVE_SMOKE:-0}" == "1" ]]; then
  run_script \
    "Run live anonymous API smoke test" \
    node "$repo_root/scripts/run-live-assessment-variation-smoke.mjs"
else
  echo ""
  echo "=== Run live anonymous API smoke test ==="
  echo "Skipped by default to avoid Supabase Auth rate limits."
  echo "Set RUN_LIVE_SMOKE=1 to include it intentionally."
fi

if [[ "${SKIP_DUPLICATE_AUDIT:-0}" != "1" ]]; then
  run_script \
    "Run question duplicate audit" \
    env \
      SUPABASE_DB_URL="$target_db_url" \
      "$repo_root/scripts/run-question-duplicate-audit.sh"
else
  echo ""
  echo "=== Run question duplicate audit ==="
  echo "Skipped because SKIP_DUPLICATE_AUDIT=1."
fi

echo ""
echo "Assessment routing regression gate completed."
