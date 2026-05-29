-- 005_kb_versions.sql
-- Append-only version history for KB entries.
-- Schema mirrors the columns of dalgo_knowledge_base that we want to snapshot.
-- Embedding is intentionally omitted from versions to save storage — re-embed
-- from snapshot text on restore.

BEGIN;

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

COMMIT;
