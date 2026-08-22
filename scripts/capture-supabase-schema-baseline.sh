#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
baseline_dir="$repo_root/supabase/baseline"
baseline_name="${BASELINE_NAME:-production_schema}"
schemas="${BASELINE_SCHEMAS:-public private}"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "ERROR: SUPABASE_DB_URL is required." >&2
  echo "Use a local, uncommitted connection string for the source database." >&2
  exit 1
fi

pg_dump_bin="${PG_DUMP_BIN:-}"

if [[ -z "$pg_dump_bin" ]]; then
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump_bin="$(command -v pg_dump)"
  elif [[ -x /opt/homebrew/opt/libpq/bin/pg_dump ]]; then
    pg_dump_bin="/opt/homebrew/opt/libpq/bin/pg_dump"
  elif [[ -x /usr/local/opt/libpq/bin/pg_dump ]]; then
    pg_dump_bin="/usr/local/opt/libpq/bin/pg_dump"
  fi
fi

if [[ -z "$pg_dump_bin" || ! -x "$pg_dump_bin" ]]; then
  echo "ERROR: pg_dump is not installed or not on PATH." >&2
  echo "If installed via Homebrew libpq, run:" >&2
  echo "  export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\"" >&2
  echo "or set PG_DUMP_BIN to the full pg_dump path." >&2
  exit 1
fi

mkdir -p "$baseline_dir"

timestamp="$(date -u +%Y%m%d%H%M%S)"
output="$baseline_dir/${timestamp}_${baseline_name}.sql"
checksum="$output.sha256"

pg_dump_args=(
  "$SUPABASE_DB_URL"
  --schema-only
  --no-owner
  --file "$output"
)

for schema in $schemas; do
  pg_dump_args+=(--schema "$schema")
done

"$pg_dump_bin" "${pg_dump_args[@]}"

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$output" > "$checksum"
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$output" > "$checksum"
else
  echo "WARN: no SHA-256 tool found; checksum was not written." >&2
fi

echo "Wrote $(realpath "$output" 2>/dev/null || printf '%s' "$output")"
if [[ -f "$checksum" ]]; then
  echo "Wrote $(realpath "$checksum" 2>/dev/null || printf '%s' "$checksum")"
fi
echo "Review the baseline before copying any sanitized version into a new migration chain."
