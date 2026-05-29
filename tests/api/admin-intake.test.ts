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

  afterAll(async () => {
    await pool().end();
  });
});
