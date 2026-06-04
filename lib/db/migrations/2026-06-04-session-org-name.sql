-- Capture the visitor's organisation name at intake (optional).
-- The org URL is already stored in sessions.ngo_url; this adds the name.
BEGIN;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ngo_name text;
COMMIT;
