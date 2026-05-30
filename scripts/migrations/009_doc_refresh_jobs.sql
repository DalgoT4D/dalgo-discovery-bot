-- 009_doc_refresh_jobs.sql — track in-progress docs re-ingest jobs (for /admin/docs UI)
--
-- Apply with:
--   docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery \
--     < scripts/migrations/009_doc_refresh_jobs.sql

BEGIN;

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

COMMIT;
