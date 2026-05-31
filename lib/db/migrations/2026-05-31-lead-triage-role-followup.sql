-- Lead triage, role capture, and follow-up opt-in (per-person on sessions).
BEGIN;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS work_domain    text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS wants_followup boolean NOT NULL DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS triage_status  text NOT NULL DEFAULT 'new'
  CHECK (triage_status IN ('new','approved','rejected'));

CREATE INDEX IF NOT EXISTS sessions_triage_status_idx ON sessions (triage_status);
COMMIT;
