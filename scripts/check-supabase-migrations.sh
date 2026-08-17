#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migration_dir="$repo_root/supabase/migrations"

if [[ ! -d "$migration_dir" ]]; then
  echo "ERROR: missing $migration_dir" >&2
  exit 1
fi

mapfile_cmd="mapfile"
if ! command -v "$mapfile_cmd" >/dev/null 2>&1; then
  versions="$(find "$migration_dir" -maxdepth 1 -type f -name '*.sql' \
    -exec basename {} \; | sed -E 's/^([0-9]+)_.*/\1/' | sort)"
else
  mapfile -t versions < <(
    find "$migration_dir" -maxdepth 1 -type f -name '*.sql' \
      -exec basename {} \; | sed -E 's/^([0-9]+)_.*/\1/' | sort
  )
  versions="$(printf '%s\n' "${versions[@]}")"
fi

duplicates="$(printf '%s\n' "$versions" | uniq -d)"
short_versions="$(printf '%s\n' "$versions" | awk 'length($0) != 14')"

if [[ -n "$duplicates" || -n "$short_versions" ]]; then
  echo "ERROR: the migration directory is not safe for Supabase CLI push." >&2
  if [[ -n "$duplicates" ]]; then
    echo "Duplicate versions:" >&2
    printf '  %s\n' $duplicates >&2
  fi
  if [[ -n "$short_versions" ]]; then
    echo "Non-14-digit versions:" >&2
    printf '%s\n' "$short_versions" | sort -u | sed 's/^/  /' >&2
  fi
  echo "Capture a live schema baseline and complete the migration reconciliation first." >&2
  exit 1
fi

echo "PASS: migration filenames use unique 14-digit versions."
