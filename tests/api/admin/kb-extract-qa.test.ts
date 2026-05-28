import { describe, it, expect, afterAll, vi } from 'vitest';
import 'dotenv/config';
import { pool } from '@/lib/db/client';
import { POST } from '@/app/api/admin/kb/extract-qa/route';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com' } }),
}));

describe('POST /api/admin/kb/extract-qa', () => {
  it('returns pairs for a valid pasted text', async () => {
    const req = new Request('http://localhost/api/admin/kb/extract-qa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: 'Dalgo is free for verified NGOs. It runs on AWS in Mumbai region.',
        category: 'pricing',
      }),
    });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.pairs)).toBe(true);
    expect(body.pairs.length).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it('400 for missing text', async () => {
    const req = new Request('http://localhost/api/admin/kb/extract-qa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(400);
  });

  afterAll(async () => { await pool().end(); });
});
