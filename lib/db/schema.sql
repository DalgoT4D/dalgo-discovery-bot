CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS dalgo_knowledge_base (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category          text NOT NULL CHECK (category IN (
                      'data_sources','transforms','dashboards','orchestration',
                      'ai','sharing','rbac','security','deployment',
                      'pricing','mission','stack','limitations')),
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
  intent      text CHECK (intent IN ('demo','pdf_report','flag_questions')),
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
    'pricing','mission','stack','limitations','case_studies'
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
  article_context text,
  last_fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blog_articles_url_idx      ON dalgo_blog_articles (url);
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
