#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

baseline_file="${BASELINE_FILE:-}"
container_name="${LOCAL_POSTGRES_CONTAINER:-obs-baseline-restore-$$}"
port="${LOCAL_POSTGRES_PORT:-55432}"
postgres_image="${LOCAL_POSTGRES_IMAGE:-postgres:17}"
postgres_password="${LOCAL_POSTGRES_PASSWORD:-postgres}"
keep_container="${KEEP_LOCAL_POSTGRES_CONTAINER:-0}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is required for the local restore smoke test." >&2
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

if [[ -z "$baseline_file" ]]; then
  baseline_file="$(find "$repo_root/supabase/baseline" -maxdepth 1 -name '*_production_schema.sql' -type f | sort | tail -n 1)"
fi

if [[ -z "$baseline_file" || ! -f "$baseline_file" ]]; then
  echo "ERROR: BASELINE_FILE was not found." >&2
  exit 1
fi

if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ERROR: local port $port is already in use. Set LOCAL_POSTGRES_PORT to another port." >&2
  exit 1
fi

cleanup() {
  if [[ "$keep_container" == "1" ]]; then
    echo "Leaving Docker container running: $container_name"
    return
  fi

  docker rm -f "$container_name" >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "Starting disposable Postgres container $container_name on 127.0.0.1:$port"
docker run \
  --detach \
  --name "$container_name" \
  --env "POSTGRES_PASSWORD=$postgres_password" \
  --publish "127.0.0.1:$port:5432" \
  "$postgres_image" >/dev/null

target_db_url="postgresql://postgres:$postgres_password@127.0.0.1:$port/postgres"

for _ in {1..60}; do
  if "$psql_bin" "$target_db_url" --quiet --command "select 1" >/dev/null 2>&1; then
    break
  fi

  sleep 1
done

"$psql_bin" "$target_db_url" --quiet --command "select 1" >/dev/null

prelude_file="$(mktemp)"
cat >"$prelude_file" <<'SQL'
drop schema if exists public cascade;

do $$
begin
  create role anon nologin;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create role authenticated nologin;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create role service_role nologin bypassrls;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create role supabase_admin nologin;
exception
  when duplicate_object then null;
end
$$;

create schema if not exists auth;
create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select null::uuid
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select '{}'::jsonb
$$;
SQL

echo "Applying local Supabase compatibility prelude"
"$psql_bin" "$target_db_url" --set ON_ERROR_STOP=1 --file "$prelude_file"
rm -f "$prelude_file"

echo "Restoring schema baseline: $baseline_file"
"$psql_bin" "$target_db_url" --set ON_ERROR_STOP=1 --file "$baseline_file"

echo "Running SQL verifier suite"
TARGET_SUPABASE_DB_URL="$target_db_url" "$repo_root/scripts/run-supabase-sql-verifiers.sh"

echo "PASS: local schema restore smoke test completed."
