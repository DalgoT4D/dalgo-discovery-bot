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

  it('rejects payloads without a valid email', async () => {
    const res = await POST(mockReq({ email: 'not-an-email' }) as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_body');
  });

  afterAll(async () => { await pool().end(); });
});
