#!/usr/bin/env bash
# Apply all Supabase migrations to a remote project.
# Requires SUPABASE_DB_PASSWORD (Dashboard → Project Settings → Database → Database password)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_REF="${SUPABASE_PROJECT_REF:-iqftexwkzhqdagrkifrp}"
SQL_FILE="$ROOT/supabase/scripts/FULL_NEW_PROJECT_SETUP.sql"

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "Error: SUPABASE_DB_PASSWORD is not set."
  echo "Find it in Supabase Dashboard → Project Settings → Database → Database password"
  exit 1
fi

if [[ ! -f "$SQL_FILE" ]]; then
  echo "Error: $SQL_FILE not found. Re-run: cat supabase/migrations/*.sql > supabase/scripts/FULL_NEW_PROJECT_SETUP.sql"
  exit 1
fi

export PGPASSWORD="$SUPABASE_DB_PASSWORD"
psql "postgresql://postgres@db.${PROJECT_REF}.supabase.co:5432/postgres" \
  -v ON_ERROR_STOP=1 \
  -f "$SQL_FILE"

echo "Migrations applied successfully."
