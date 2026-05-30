-- Migration: eval runs become a Postgres-backed queue (drained by the
-- /api/cron/eval-drain cron in time-bounded chunks instead of one fire-and-forget
-- background task). Run ONCE against each environment. The DDL is folded into
-- schema.sql; this file also performs the one-time data cleanup that schema.sql
-- (idempotent CREATE/ALTER only) must not.
--
-- Apply (prod): psql "$DATABASE_URL" -f lib/db/migrations/2026-05-30-eval-run-queue.sql

BEGIN;

-- 1. Queue columns (idempotent).
ALTER TABLE dalgo_eval_runs ADD COLUMN IF NOT EXISTS next_offset int NOT NULL DEFAULT 0;
ALTER TABLE dalgo_eval_runs ADD COLUMN IF NOT EXISTS locked_at   timestamptz;

-- 2. One-time cleanup: the pre-queue fire-and-forget implementation left runs
--    stuck in 'pending'/'running' when their background promise was killed. With
--    the new drainer (which claims any non-terminal 'full' run, and treats a NULL
--    lease as claimable) these would be picked up and re-executed on the first
--    cron tick. Abandon them so only genuinely new runs are processed.
UPDATE dalgo_eval_runs
   SET status      = 'failed',
       error       = 'abandoned before eval-run queue migration',
       finished_at = now()
 WHERE status IN ('pending', 'running');

COMMIT;
