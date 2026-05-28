-- 003_eval_cases.sql
-- Add dalgo_eval_cases + dalgo_eval_case_versions, mirroring the prompts pattern.

CREATE TABLE IF NOT EXISTS dalgo_eval_cases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_key      text NOT NULL,
  bucket        text NOT NULL,
  input         text NOT NULL,
  expected      jsonb NOT NULL DEFAULT '{}'::jsonb,
  judges        text[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled       boolean NOT NULL DEFAULT TRUE,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_by    text NOT NULL DEFAULT 'system'
);

CREATE UNIQUE INDEX IF NOT EXISTS dalgo_eval_cases_case_key_uniq
  ON dalgo_eval_cases(case_key);

CREATE INDEX IF NOT EXISTS dalgo_eval_cases_bucket_idx
  ON dalgo_eval_cases(bucket);

CREATE TABLE IF NOT EXISTS dalgo_eval_case_versions (
  id          bigserial PRIMARY KEY,
  case_id     uuid NOT NULL REFERENCES dalgo_eval_cases(id) ON DELETE CASCADE,
  case_key    text NOT NULL,
  bucket      text NOT NULL,
  input       text NOT NULL,
  expected    jsonb NOT NULL,
  judges      text[] NOT NULL,
  enabled     boolean NOT NULL,
  notes       text,
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dalgo_eval_case_versions_case_id_idx
  ON dalgo_eval_case_versions(case_id, updated_at DESC);
