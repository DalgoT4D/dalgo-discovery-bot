import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { getSession, setWantsFollowup, setTriageStatus } from '@/lib/db/queries/sessions';

async function newSession(): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO sessions (email) VALUES ($1) RETURNING id`,
    [`triage-${Date.now()}-${Math.round(performance.now())}@x.org`],
  );
  return rows[0].id;
}

describe('sessions triage helpers', () => {
  it('setWantsFollowup flips the flag and is idempotent', async () => {
    const id = await newSession();
    await setWantsFollowup(id);
    await setWantsFollowup(id);
    const s = await getSession(id);
    expect(s.wants_followup).toBe(true);
  });

  it('setTriageStatus updates the status', async () => {
    const id = await newSession();
    await setTriageStatus(id, 'approved');
    const s = await getSession(id);
    expect(s.triage_status).toBe('approved');
  });

  afterAll(async () => { await pool().end(); });
});
