-- 007_docs.sql — product documentation corpus
-- Apply with:
--   docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery \
--     < scripts/migrations/007_docs.sql

BEGIN;

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

COMMIT;
