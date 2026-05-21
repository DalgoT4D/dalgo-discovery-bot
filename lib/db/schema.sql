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
