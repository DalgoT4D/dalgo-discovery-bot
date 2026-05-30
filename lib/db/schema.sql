CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS dalgo_knowledge_base (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category          text NOT NULL CHECK (category IN (
                      'data_sources','transforms','dashboards','orchestration',
                      'ai','sharing','rbac','security','deployment',
                      'pricing','mission','stack','limitations','case_studies','community')),
  question_variants text[] NOT NULL,
  canonical_answer  text NOT NULL,
  status            text NOT NULL CHECK (status IN ('yes','partial','no','roadmap')),
  ngo_framing       text,
  evidence          text[],
  related           uuid[],
  embedding         vector(1536),
  last_verified     timestamptz NOT NULL DEFAULT now(),
  source_audit_date date,
  notes_for_sales   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kb_embedding_idx ON dalgo_knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS kb_category_idx  ON dalgo_knowledge_base (category);
CREATE INDEX IF NOT EXISTS kb_status_idx    ON dalgo_knowledge_base (status);

CREATE TABLE IF NOT EXISTS sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  ip          inet,
  email       text,
  ngo_url     text,
  ngo_summary text,
  ngo_systems text,
  data_types  text[],
  pdf_url     text,
  pdf_text    text
);
CREATE INDEX IF NOT EXISTS sessions_created_idx ON sessions (created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user','assistant','tool')),
  content     jsonb NOT NULL,
  token_count int,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_session_idx ON messages (session_id, created_at);

CREATE TABLE IF NOT EXISTS leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid REFERENCES sessions(id) ON DELETE SET NULL,
  email       text NOT NULL,
  intent      text CHECK (intent IN ('demo','pdf_report','flag_questions','email_signup')),
  summary     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  rating      smallint NOT NULL CHECK (rating IN (-1, 1)),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telemetry_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid REFERENCES sessions(id) ON DELETE CASCADE,
  event_name  text NOT NULL,
  fields      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telemetry_event_idx ON telemetry_events (event_name, created_at DESC);

CREATE TABLE IF NOT EXISTS unanswered_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question    text NOT NULL,
  session_id  uuid REFERENCES sessions(id) ON DELETE SET NULL,
  reviewed    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  ip          inet PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count       int NOT NULL DEFAULT 0
);

-- KB vector match RPC (used by lib/db/queries/kb.ts in Task 7)
CREATE OR REPLACE FUNCTION kb_match(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  category text,
  question_variants text[],
  canonical_answer text,
  status text,
  ngo_framing text,
  evidence text[],
  notes_for_sales text,
  distance float
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id, kb.category, kb.question_variants, kb.canonical_answer, kb.status,
    kb.ngo_framing, kb.evidence, kb.notes_for_sales,
    (kb.embedding <=> query_embedding)::float AS distance
  FROM dalgo_knowledge_base kb
  WHERE filter_category IS NULL OR kb.category = filter_category
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- Phase 1: Blog ingestion (added 2026-05-25)
-- ============================================================

-- Sync the live category CHECK (case_studies was added in prod
-- but not in schema.sql). Re-running this is idempotent.
ALTER TABLE dalgo_knowledge_base DROP CONSTRAINT IF EXISTS dalgo_knowledge_base_category_check;
ALTER TABLE dalgo_knowledge_base ADD CONSTRAINT dalgo_knowledge_base_category_check
  CHECK (category IN (
    'data_sources','transforms','dashboards','orchestration',
    'ai','sharing','rbac','security','deployment',
    'pricing','mission','stack','limitations','case_studies','community'
  ));

CREATE TABLE IF NOT EXISTS dalgo_blog_articles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url             text UNIQUE NOT NULL,
  title           text NOT NULL,
  category        text NOT NULL,
  author          text,
  published_at    date,
  excerpt         text,
  content_md      text NOT NULL,
  content_hash    text NOT NULL,
  article_context text,                  -- populated by contextualizer; NULL means not yet processed
  last_fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blog_articles_category_idx ON dalgo_blog_articles (category);

CREATE TABLE IF NOT EXISTS dalgo_blog_chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id      uuid NOT NULL REFERENCES dalgo_blog_articles(id) ON DELETE CASCADE,
  chunk_index     int  NOT NULL,
  chunk_text      text NOT NULL,
  contextual_text text NOT NULL,
  embedding       vector(1536) NOT NULL,
  tsv             tsvector GENERATED ALWAYS AS (to_tsvector('english', contextual_text)) STORED,
  UNIQUE (article_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS blog_chunks_embedding_idx ON dalgo_blog_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS blog_chunks_tsv_idx       ON dalgo_blog_chunks USING gin (tsv);

CREATE TABLE IF NOT EXISTS blog_refresh_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status        text NOT NULL CHECK (status IN ('running','succeeded','failed')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  posts_seen    int NOT NULL DEFAULT 0,
  posts_new     int NOT NULL DEFAULT 0,
  posts_updated int NOT NULL DEFAULT 0,
  posts_skipped int NOT NULL DEFAULT 0,
  error         text
);

-- ============================================================
-- Phase 2: Hybrid retrieval (added 2026-05-25)
-- ============================================================

-- IMMUTABLE wrapper around array_to_string (the built-in is STABLE,
-- which Postgres rejects in GENERATED ALWAYS expressions). Safe because
-- the result depends only on the inputs.
CREATE OR REPLACE FUNCTION immutable_array_to_string(text[], text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT array_to_string($1, $2) $$;

-- Add lexical search to the existing KB so it can participate in hybrid retrieval
ALTER TABLE dalgo_knowledge_base
  ADD COLUMN IF NOT EXISTS tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('english'::regconfig,
      immutable_array_to_string(question_variants, ' ') || ' ' || canonical_answer)
  ) STORED;
CREATE INDEX IF NOT EXISTS kb_tsv_idx ON dalgo_knowledge_base USING gin (tsv);

-- Curated problem patterns (consultant brain)
CREATE TABLE IF NOT EXISTS dalgo_problem_patterns (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archetype          text NOT NULL UNIQUE,
  problem_phrasing   text[] NOT NULL,
  consultant_framing text NOT NULL,
  dalgo_response     text NOT NULL,
  evidence_urls      text[] NOT NULL DEFAULT '{}',
  embedding          vector(1536) NOT NULL,
  tsv                tsvector GENERATED ALWAYS AS (
                       to_tsvector('english'::regconfig,
                         coalesce(archetype,'') || ' ' ||
                         coalesce(immutable_array_to_string(problem_phrasing,' '),'') || ' ' ||
                         coalesce(consultant_framing,'')
                       )
                     ) STORED,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS problem_patterns_tsv_idx       ON dalgo_problem_patterns USING gin (tsv);

-- ============================================================
-- Phase 3: Provenance + retrieval trace (added 2026-05-25)
-- ============================================================

ALTER TABLE dalgo_knowledge_base
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'seed';
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dalgo_knowledge_base_source_check'
  ) THEN
    ALTER TABLE dalgo_knowledge_base ADD CONSTRAINT dalgo_knowledge_base_source_check
      CHECK (source IN ('seed','admin_manual','promoted_from_conversation','promoted_from_unanswered'));
  END IF;
END $$;

ALTER TABLE dalgo_knowledge_base
  ADD COLUMN IF NOT EXISTS source_message_id uuid REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE dalgo_knowledge_base
  ADD COLUMN IF NOT EXISTS author_email text;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS retrieval_trace jsonb;

-- ============================================================
-- Phase 4: Admin-editable prompts + wrong-answer reports (2026-05-26)
-- ============================================================

-- Note: seed migrations 001 + 002 populate 6 sections: identity, tools_inventory,
-- rules, consultant_mode, dalgo_vs_3rd_party, fit_assessment. See scripts/migrations/.

CREATE TABLE IF NOT EXISTS dalgo_prompts (
  key         text PRIMARY KEY,
  content     text NOT NULL,
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dalgo_prompt_versions (
  id          bigserial PRIMARY KEY,
  prompt_key  text NOT NULL REFERENCES dalgo_prompts(key) ON DELETE CASCADE,
  content     text NOT NULL,
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prompt_versions_key_idx
  ON dalgo_prompt_versions (prompt_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS wrong_answer_reports (
  id                   bigserial PRIMARY KEY,
  message_id           uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reason               text NOT NULL,
  retrieval_trace_snap jsonb,
  fixed_kb_id          uuid REFERENCES dalgo_knowledge_base(id) ON DELETE SET NULL,
  reported_by          text NOT NULL,
  reported_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wrong_answer_reports_msg_idx
  ON wrong_answer_reports (message_id);

-- ============================================================
-- Phase 5: Email-gate modal (added 2026-05-27)
-- ============================================================

-- Sessions now store the captured email from the email-gate modal.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS email text;

-- Extend leads.intent CHECK to accept 'email_signup' (auto-recorded
-- when the email gate is satisfied). Drop-and-re-add for idempotency.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_intent_check;
ALTER TABLE leads ADD CONSTRAINT leads_intent_check
  CHECK (intent IN ('demo','pdf_report','flag_questions','email_signup'));

-- ============================================================
-- Phase 6: Multi-admin support (added 2026-05-27)
-- ============================================================

-- DB-backed admins replace the single env-var admin (ADMIN_USERNAME /
-- ADMIN_PASSWORD_HASH). The env vars are kept as a one-time seed
-- mechanism via lib/db/bootstrap.ts. is_system marks the seed admin,
-- who is the only one allowed to manage other admins.
CREATE TABLE IF NOT EXISTS admins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  is_system     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- Eval cases (migration 003 — kept in sync with this schema file)
-- ============================================================

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
  updated_by    text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS dalgo_eval_cases_case_key_idx
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

-- ============================================================
-- Eval runs (migration 004 — kept in sync with this schema file)
-- ============================================================

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

-- KB versioning (migration 005 — kept in sync with this schema file)
CREATE TABLE IF NOT EXISTS dalgo_kb_versions (
  id                bigserial PRIMARY KEY,
  kb_id             uuid NOT NULL REFERENCES dalgo_knowledge_base(id) ON DELETE CASCADE,
  category          text NOT NULL,
  question_variants text[] NOT NULL,
  canonical_answer  text NOT NULL,
  status            text,
  ngo_framing       text,
  evidence          text[],
  notes_for_sales   text,
  updated_by        text NOT NULL,
  updated_at        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dalgo_kb_versions_kb_id_idx
  ON dalgo_kb_versions(kb_id, updated_at DESC);

-- Product documentation corpus (migration 007 — kept in sync with this schema file)
CREATE TABLE IF NOT EXISTS dalgo_doc_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url             text UNIQUE NOT NULL,
  title           text NOT NULL,
  content_md      text NOT NULL,
  content_hash    text NOT NULL,
  last_fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dalgo_doc_chunks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id      uuid NOT NULL REFERENCES dalgo_doc_pages(id) ON DELETE CASCADE,
  chunk_index  int  NOT NULL,
  chunk_text   text NOT NULL,
  embedding    vector(1536) NOT NULL,
  tsv          tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED,
  UNIQUE (page_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS doc_chunks_embedding_idx
  ON dalgo_doc_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS doc_chunks_tsv_idx
  ON dalgo_doc_chunks USING GIN (tsv);

-- Docs refresh job tracker (migration 009 — kept in sync with this schema file)
CREATE TABLE IF NOT EXISTS doc_refresh_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status        text NOT NULL CHECK (status IN ('queued','running','succeeded','failed')) DEFAULT 'queued',
  pages_seen    int NOT NULL DEFAULT 0,
  pages_new     int NOT NULL DEFAULT 0,
  pages_updated int NOT NULL DEFAULT 0,
  pages_skipped int NOT NULL DEFAULT 0,
  started_at    timestamptz,
  finished_at   timestamptz,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- sessions.is_admin (migration 010 — kept in sync with this schema file).
-- Binds admin status to the chat session itself, not to whatever NextAuth
-- cookie the browser is carrying. Critical: without it, a guest chat opened
-- in a browser where admin is signed in elsewhere would show admin UI.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS sessions_is_admin_idx ON sessions (is_admin) WHERE is_admin;
