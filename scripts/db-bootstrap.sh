#!/usr/bin/env bash
#
# Bootstrap a fresh Postgres (with the pgvector extension) for the Dalgo
# Discovery Bot: applies the base schema, every migration in both migration
# dirs, then RE-APPLIES schema.sql to converge the historically-drifted
# `dalgo_knowledge_base` category CHECK constraint (older migrations narrow it;
# schema.sql holds the full, current list).
#
# This handles SCHEMA + the dalgo_prompts system-prompt rows (which are seeded
# by the migrations). It does NOT embed KB / blog / docs content — for that run
# the `npm run seed:*` scripts afterwards (they need Node + OPENAI_API_KEY).
#
# Requirements: `psql` on PATH. The server must have the `vector` extension
# available (AWS RDS Postgres 16 does; schema.sql runs CREATE EXTENSION).
#
# Usage:
#   DATABASE_URL='postgres://user:pass@host:5432/dalgo_discovery?sslmode=require' \
#     ./scripts/db-bootstrap.sh
#   # or pass the connection string as the first argument:
#   ./scripts/db-bootstrap.sh 'postgres://user:pass@host:5432/dalgo_discovery'
#
set -euo pipefail

DB="${1:-${DATABASE_URL:-}}"
if [ -z "$DB" ]; then
  echo "ERROR: set DATABASE_URL or pass a connection string as the first arg." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
run() { echo "  → $(basename "$1")"; psql "$DB" -v ON_ERROR_STOP=1 -q -f "$1"; }

echo "== 1/4  base schema =="
run "$ROOT/lib/db/schema.sql"

echo "== 2/4  scripts/migrations (prompts, eval, kb-versions, docs, categories) =="
for f in "$ROOT"/scripts/migrations/*.sql; do run "$f"; done

echo "== 3/4  lib/db/migrations (eval queue, lead triage, session columns) =="
for f in "$ROOT"/lib/db/migrations/*.sql; do run "$f"; done

echo "== 4/4  re-apply schema.sql (converge category CHECK constraint) =="
run "$ROOT/lib/db/schema.sql"

echo "✓ Schema + migrations applied. Next: run the npm run seed:* scripts."
