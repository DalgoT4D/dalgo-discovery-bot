import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { insertLead } from '@/lib/db/queries/leads';
import { auth } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
const mockAuth = vi.mocked(auth);
beforeEach(() => {
  mockAuth.mockResolvedValue({ user: { email: 'admin@example.com' } } as never);
});

import { GET } from '@/app/api/admin/leads/route';

describe('GET /api/admin/leads (person-centric)', () => {
  it('returns one row per non-admin session with email + demo flag', async () => {
    const email = `leadq-${Date.now()}@x.org`;
    const { rows } = await query<{ id: string }>(
      `INSERT INTO sessions (email, work_domain, wants_followup) VALUES ($1,'data_tech',true) RETURNING id`,
      [email],
    );
    const sessionId = rows[0].id;
    await insertLead({ sessionId, email, intent: 'email_signup' });
    await insertLead({ sessionId, email, intent: 'demo' });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const mine = body.items.filter((r: { email: string }) => r.email === email);
    expect(mine.length).toBe(1);
    expect(mine[0].session_id).toBe(sessionId);
    expect(mine[0].requested_demo).toBe(true);
    expect(mine[0].wants_followup).toBe(true);
    expect(mine[0].work_domain).toBe('data_tech');
    expect(mine[0].triage_status).toBe('new');
  });

  it('excludes admin sessions', async () => {
    const email = `leadadmin-${Date.now()}@x.org`;
    await query(`INSERT INTO sessions (email, is_admin) VALUES ($1, true)`, [email]);
    const res = await GET();
    const body = await res.json();
    expect(body.items.find((r: { email: string }) => r.email === email)).toBeUndefined();
  });

  it('401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  afterAll(async () => { await pool().end(); });
});
