import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { POST } from '@/app/api/intake/route';
import { pool } from '@/lib/db/client';

function mockReq(body: unknown): Request {
  return new Request('http://test/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/intake', () => {
  it('creates a session and returns its id', async () => {
    const res = await POST(mockReq({ ngo_systems: 'KoboToolbox and Excel' }) as any);
    const json = await res.json();
    expect(json.session_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  afterAll(async () => { await pool().end(); });
});
