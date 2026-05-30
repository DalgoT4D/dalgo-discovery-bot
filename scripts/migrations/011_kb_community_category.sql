-- 011_kb_community_category.sql
-- Add 'community' to the KB category CHECK so we can store entries that
-- point users to dalgo.org sections (team, events, contact, resources)
-- instead of inventing live event data the bot doesn't actually have.
--
-- Apply with:
--   docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery \
--     < scripts/migrations/011_kb_community_category.sql

BEGIN;

ALTER TABLE dalgo_knowledge_base
  DROP CONSTRAINT IF EXISTS dalgo_knowledge_base_category_check;

ALTER TABLE dalgo_knowledge_base
  ADD CONSTRAINT dalgo_knowledge_base_category_check
  CHECK (category IN (
    'data_sources','transforms','dashboards','orchestration',
    'ai','sharing','rbac','security','deployment',
    'pricing','mission','stack','limitations','case_studies',
    'community'
  ));

COMMIT;
