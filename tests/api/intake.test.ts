import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { POST } from '@/app/api/intake/route';
import { pool, query } from '@/lib/db/client';

function mockReq(body: unknown): Request {
  return new Request('http://test/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/intake', () => {
  it('creates a session for a valid email and auto-records an email_signup lead', async () => {
    const email = `test+${Date.now()}@example.org`;
    const res = await POST(mockReq({ email }) as any);
    const json = await res.json();
    expect(res.status).toBe(200);
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

  it('resumes the existing session when the same email is posted twice', async () => {
    const email = `resume+${Date.now()}@example.org`;

    const first = await POST(mockReq({ email }) as any);
    const firstJson = await first.json();
    expect(first.status).toBe(200);
    expect(firstJson.resumed).toBe(false);
    const firstSessionId = firstJson.session_id;

    const second = await POST(mockReq({ email }) as any);
    const secondJson = await second.json();
    expect(second.status).toBe(200);
    expect(secondJson.resumed).toBe(true);
    expect(secondJson.session_id).toBe(firstSessionId);

    // No additional session row was created.
    const { rows: sessionRows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM sessions WHERE email = $1`,
      [email],
    );
    expect(sessionRows[0]?.count).toBe('1');

    // No additional lead row was created on resume.
    const { rows: leadRows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM leads WHERE email = $1`,
      [email],
    );
    expect(leadRows[0]?.count).toBe('1');
  });

  it('marks the created session row as is_admin = false (guest)', async () => {
    const email = `guest+isadmin+${Date.now()}@example.org`;
    const res = await POST(mockReq({ email }) as any);
    const json = await res.json();
    expect(res.status).toBe(200);

    const { rows } = await query<{ is_admin: boolean }>(
      `SELECT is_admin FROM sessions WHERE id = $1`,
      [json.session_id],
    );
    expect(rows[0]?.is_admin).toBe(false);
  });

  it('rejects payloads without a valid email', async () => {
    const res = await POST(mockReq({ email: 'not-an-email' }) as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_body');
  });

  afterAll(async () => { await pool().end(); });
});
