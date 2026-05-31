import { describe, it, expect, afterAll, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';

vi.mock('@/lib/slack', () => ({ postHotLead: vi.fn(async () => {}) }));

import { PATCH } from '@/app/api/followup/route';

function req(body: unknown) {
  return new Request('http://localhost/api/followup', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function newSession(): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO sessions (email) VALUES ($1) RETURNING id`,
    [`followup-${Date.now()}@x.org`],
  );
  return rows[0].id;
}

describe('PATCH /api/followup', () => {
  it('sets wants_followup and is idempotent', async () => {
    const id = await newSession();
    const res1 = await PATCH(req({ session_id: id }));
    expect(res1.status).toBe(200);
    await PATCH(req({ session_id: id }));
    const { rows } = await query(`SELECT wants_followup FROM sessions WHERE id = $1`, [id]);
    expect(rows[0].wants_followup).toBe(true);
  });

  it('404 on unknown session', async () => {
    const res = await PATCH(req({ session_id: '00000000-0000-0000-0000-000000000000' }));
    expect(res.status).toBe(404);
  });

  it('400 on invalid body', async () => {
    const res = await PATCH(req({ nope: true }));
    expect(res.status).toBe(400);
  });

  afterAll(async () => { await pool().end(); });
});
