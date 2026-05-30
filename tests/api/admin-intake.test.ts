import { describe, it, expect, afterAll, afterEach, beforeAll, vi, beforeEach } from 'vitest';
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

// Insert a matching admin row so the new "admin must still exist in DB"
// guard in /api/admin-intake passes. Hash value is fake — the route reads
// only the email from auth(), not the password.
async function seedAdmin(email: string) {
  await query(
    `INSERT INTO admins (email, password_hash, is_system) VALUES ($1, $2, false)
     ON CONFLICT (email) DO NOTHING`,
    [email, '$2b$10$fake.fake.fake.fake.fake.fake.fake.fake.fake.fake.fak'],
  );
}

describe('POST /api/admin-intake', () => {
  beforeAll(async () => {
    await query(`DELETE FROM leads    WHERE email LIKE 'admintest+%@example.org'`);
    await query(`DELETE FROM sessions WHERE email LIKE 'admintest+%@example.org'`);
    await query(`DELETE FROM admins   WHERE email LIKE 'admintest+%@example.org'`);
  });

  beforeEach(() => {
    authMock.mockReset();
  });

  afterEach(async () => {
    await query(`DELETE FROM leads    WHERE email LIKE 'admintest+%@example.org'`);
    await query(`DELETE FROM sessions WHERE email LIKE 'admintest+%@example.org'`);
    await query(`DELETE FROM admins   WHERE email LIKE 'admintest+%@example.org'`);
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

  it('returns 401 when the cookie email no longer exists in the admins table (stale JWT)', async () => {
    // Simulates: admin was signed in, then their admins row was deleted (or
    // never existed — e.g. JWT forged with a random email). Cookie is still
    // valid JWT-wise but must not grant access.
    const orphanEmail = `admintest+orphan+${Date.now()}@example.org`;
    authMock.mockResolvedValue({ user: { email: orphanEmail } });

    const res = await POST(mockReq() as any);
    expect(res.status).toBe(401);

    // No session row should have been created for the orphan.
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM sessions WHERE email = $1`,
      [orphanEmail],
    );
    expect(rows[0]?.count).toBe('0');
  });

  it('creates a session and lead for the authenticated admin email', async () => {
    const email = `admintest+${Date.now()}@example.org`;
    await seedAdmin(email);
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
    await seedAdmin(email);
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

  it('marks the created session row as is_admin = true', async () => {
    const email = `admintest+isadmin+${Date.now()}@example.org`;
    await seedAdmin(email);
    authMock.mockResolvedValue({ user: { email } });

    const res = await POST(mockReq() as any);
    const json = await res.json();
    expect(res.status).toBe(200);

    const { rows } = await query<{ is_admin: boolean }>(
      `SELECT is_admin FROM sessions WHERE id = $1`,
      [json.session_id],
    );
    expect(rows[0]?.is_admin).toBe(true);
  });

  it('lowercases and trims the email from the auth session', async () => {
    const raw = `  ADMINTEST+CASE+${Date.now()}@Example.Org  `;
    const normalized = raw.toLowerCase().trim();
    await seedAdmin(normalized);
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
