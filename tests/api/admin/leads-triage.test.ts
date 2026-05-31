import { describe, it, expect, afterAll, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com' } }),
}));

import { PATCH } from '@/app/api/admin/leads/[sessionId]/route';

function req(body: unknown) {
  return new Request('http://localhost/api/admin/leads/x', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function newSession(): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO sessions (email) VALUES ($1) RETURNING id`,
    [`triagep-${Date.now()}@x.org`],
  );
  return rows[0].id;
}

describe('PATCH /api/admin/leads/[sessionId]', () => {
  it('updates triage_status', async () => {
    const id = await newSession();
    const res = await PATCH(req({ triage_status: 'approved' }), { params: Promise.resolve({ sessionId: id }) });
    expect(res.status).toBe(200);
    const { rows } = await query(`SELECT triage_status FROM sessions WHERE id = $1`, [id]);
    expect(rows[0].triage_status).toBe('approved');
  });

  it('400 on invalid status', async () => {
    const id = await newSession();
    const res = await PATCH(req({ triage_status: 'maybe' }), { params: Promise.resolve({ sessionId: id }) });
    expect(res.status).toBe(400);
  });

  it('404 on unknown session', async () => {
    const fake = '00000000-0000-0000-0000-000000000000';
    const res = await PATCH(req({ triage_status: 'rejected' }), { params: Promise.resolve({ sessionId: fake }) });
    expect(res.status).toBe(404);
  });

  afterAll(async () => { await pool().end(); });
});
