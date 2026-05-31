-- Migration: allow eval runs to be cancelled from the admin UI.
-- Adds 'cancelled' to the dalgo_eval_runs.status CHECK. Run ONCE per environment.
--
-- Apply (prod): psql "$DATABASE_URL" -f lib/db/migrations/2026-05-31-eval-run-cancel.sql

ALTER TABLE dalgo_eval_runs DROP CONSTRAINT IF EXISTS dalgo_eval_runs_status_check;
ALTER TABLE dalgo_eval_runs ADD CONSTRAINT dalgo_eval_runs_status_check
  CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled'));
