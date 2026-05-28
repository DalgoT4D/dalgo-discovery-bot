-- 004_eval_runs.sql
-- Tables for eval run history and per-case results.

BEGIN;

CREATE TABLE IF NOT EXISTS dalgo_eval_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status        text NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  kind          text NOT NULL CHECK (kind IN ('full', 'single')),
  triggered_by  text NOT NULL,
  total_cases   int NOT NULL DEFAULT 0,
  passed_count  int NOT NULL DEFAULT 0,
  failed_count  int NOT NULL DEFAULT 0,
  started_at    timestamptz NOT NULL DEFAULT NOW(),
  finished_at   timestamptz,
  error         text
);

CREATE INDEX IF NOT EXISTS dalgo_eval_runs_started_at_idx
  ON dalgo_eval_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS dalgo_eval_run_results (
  id               bigserial PRIMARY KEY,
  run_id           uuid NOT NULL REFERENCES dalgo_eval_runs(id) ON DELETE CASCADE,
  case_id          uuid REFERENCES dalgo_eval_cases(id) ON DELETE SET NULL,
  case_key         text NOT NULL,
  bucket           text NOT NULL,
  pass             boolean NOT NULL,
  judge_results    jsonb NOT NULL DEFAULT '[]'::jsonb,
  bot_response     text,
  retrieval_trace  jsonb,
  tool_calls       jsonb,
  latency_ms       int,
  created_at       timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dalgo_eval_run_results_run_id_idx
  ON dalgo_eval_run_results(run_id);

CREATE INDEX IF NOT EXISTS dalgo_eval_run_results_case_id_idx
  ON dalgo_eval_run_results(case_id);

COMMIT;
