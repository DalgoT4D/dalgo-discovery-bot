import { describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';

const authMock = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: () => authMock(),
}));

// Imported after vi.mock so the route picks up the mocked module.
import { POST } from '@/app/api/admin-intake/route';

function mockReq(): Request {
  return new Request('http://test/api/admin-intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/admin-intake', () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it('returns 401 when there is no authenticated session', async () => {
    authMock.mockResolvedValue(null);

    const res = await POST(mockReq() as any);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('unauthorized');

    // No DB rows should have been created.
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM sessions WHERE email LIKE 'admintest+%@example.org'`,
    );
    expect(rows[0]?.count).toBe('0');
  });

  it('creates a session and lead for the authenticated admin email', async () => {
    const email = `admintest+${Date.now()}@example.org`;
    authMock.mockResolvedValue({ user: { email } });

    const res = await POST(mockReq() as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(json.resumed).toBe(false);

    const { rows: sessionRows } = await query<{ email: string | null }>(
      `SELECT email FROM sessions WHERE id = $1`,
      [json.session_id],
    );
    expect(sessionRows[0]?.email).toBe(email);

    const { rows: leadRows } = await query<{ intent: string; email: string }>(
      `SELECT intent, email FROM leads WHERE session_id = $1`,
      [json.session_id],
    );
    expect(leadRows[0]).toEqual({ intent: 'email_signup', email });
  });

  it('resumes the existing session when the same admin posts twice', async () => {
    const email = `admintest+resume+${Date.now()}@example.org`;
    authMock.mockResolvedValue({ user: { email } });

    const first = await POST(mockReq() as any);
    const firstJson = await first.json();
    expect(first.status).toBe(200);
    expect(firstJson.resumed).toBe(false);

    const second = await POST(mockReq() as any);
    const secondJson = await second.json();
    expect(second.status).toBe(200);
    expect(secondJson.resumed).toBe(true);
    expect(secondJson.session_id).toBe(firstJson.session_id);

    const { rows: sessionRows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM sessions WHERE email = $1`,
      [email],
    );
    expect(sessionRows[0]?.count).toBe('1');

    const { rows: leadRows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM leads WHERE email = $1`,
      [email],
    );
    expect(leadRows[0]?.count).toBe('1');
  });

  it('lowercases and trims the email from the auth session', async () => {
    const raw = `  ADMINTEST+CASE+${Date.now()}@Example.Org  `;
    const normalized = raw.toLowerCase().trim();
    authMock.mockResolvedValue({ user: { email: raw } });

    const res = await POST(mockReq() as any);
    expect(res.status).toBe(200);
    const json = await res.json();

    const { rows } = await query<{ email: string | null }>(
      `SELECT email FROM sessions WHERE id = $1`,
      [json.session_id],
    );
    expect(rows[0]?.email).toBe(normalized);
  });

  afterAll(async () => {
    await pool().end();
  });
});
