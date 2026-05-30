-- 010_sessions_is_admin.sql
-- Bind admin badge / admin-only chat actions to the SESSION, not to whatever
-- NextAuth cookie the browser happens to carry. Without this, opening a guest
-- chat in a tab where an admin is signed in elsewhere wrongly shows the
-- admin UI (badge + per-message admin actions).
--
-- Apply with:
--   docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery \
--     < scripts/migrations/010_sessions_is_admin.sql

BEGIN;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS sessions_is_admin_idx ON sessions (is_admin) WHERE is_admin;

-- Backfill: any pre-existing session whose intake email matches an admin row
-- gets marked admin so we don't lose admin context on chats already in flight.
UPDATE sessions
   SET is_admin = true
 WHERE is_admin = false
   AND lower(email) IN (SELECT lower(email) FROM admins);

COMMIT;
