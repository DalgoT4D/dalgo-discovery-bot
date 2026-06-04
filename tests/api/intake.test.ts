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
});

describe('POST /api/intake work_domain', () => {
  function req(body: unknown) {
    return new Request('http://localhost/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as unknown as import('next/server').NextRequest;
  }

  it('persists work_domain when provided', async () => {
    const email = `intake-${Date.now()}@x.org`;
    const res = await POST(req({ email, work_domain: 'leadership' }));
    expect(res.status).toBe(200);
    const { session_id } = await res.json();
    const { rows } = await query(`SELECT work_domain FROM sessions WHERE id = $1`, [session_id]);
    expect(rows[0].work_domain).toBe('leadership');
  });

  it('allows omitting work_domain', async () => {
    const email = `intake-norole-${Date.now()}@x.org`;
    const res = await POST(req({ email }));
    expect(res.status).toBe(200);
    const { session_id } = await res.json();
    const { rows } = await query(`SELECT work_domain FROM sessions WHERE id = $1`, [session_id]);
    expect(rows[0].work_domain).toBeNull();
  });

  it('rejects an invalid work_domain', async () => {
    const res = await POST(req({ email: `bad-${Date.now()}@x.org`, work_domain: 'wizard' }));
    expect(res.status).toBe(400);
  });

  it('backfills work_domain on resume when none was stored, but never overwrites an existing one', async () => {
    const email = `intake-backfill-${Date.now()}@x.org`;

    // First intake without a role → stored as NULL.
    const first = await POST(req({ email }));
    const { session_id } = await first.json();

    // Resume with a role → backfilled onto the same session.
    const second = await POST(req({ email, work_domain: 'data_tech' }));
    const secondJson = await second.json();
    expect(secondJson.session_id).toBe(session_id);
    let { rows } = await query(`SELECT work_domain FROM sessions WHERE id = $1`, [session_id]);
    expect(rows[0].work_domain).toBe('data_tech');

    // Resume again with a different role → must NOT overwrite the stored value.
    await POST(req({ email, work_domain: 'leadership' }));
    ({ rows } = await query(`SELECT work_domain FROM sessions WHERE id = $1`, [session_id]));
    expect(rows[0].work_domain).toBe('data_tech');
  });
});

describe('POST /api/intake org name + url', () => {
  function req(body: unknown) {
    return new Request('http://localhost/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as unknown as import('next/server').NextRequest;
  }

  it('persists org_name and org_url when provided', async () => {
    const email = `intake-org-${Date.now()}@x.org`;
    const res = await POST(req({ email, org_name: 'Helping Hands', org_url: 'helpinghands.org' }));
    expect(res.status).toBe(200);
    const { session_id } = await res.json();
    const { rows } = await query<{ ngo_name: string | null; ngo_url: string | null }>(
      `SELECT ngo_name, ngo_url FROM sessions WHERE id = $1`,
      [session_id],
    );
    expect(rows[0].ngo_name).toBe('Helping Hands');
    expect(rows[0].ngo_url).toBe('helpinghands.org');
  });

  it('allows omitting org fields (stored as null)', async () => {
    const email = `intake-noorg-${Date.now()}@x.org`;
    const res = await POST(req({ email }));
    expect(res.status).toBe(200);
    const { session_id } = await res.json();
    const { rows } = await query<{ ngo_name: string | null; ngo_url: string | null }>(
      `SELECT ngo_name, ngo_url FROM sessions WHERE id = $1`,
      [session_id],
    );
    expect(rows[0].ngo_name).toBeNull();
    expect(rows[0].ngo_url).toBeNull();
  });

  it('backfills org fields on resume but never overwrites an existing value', async () => {
    const email = `intake-org-backfill-${Date.now()}@x.org`;
    const first = await POST(req({ email }));
    const { session_id } = await first.json();

    // Resume with org details → backfilled.
    await POST(req({ email, org_name: 'First Org', org_url: 'first.org' }));
    let { rows } = await query<{ ngo_name: string; ngo_url: string }>(
      `SELECT ngo_name, ngo_url FROM sessions WHERE id = $1`,
      [session_id],
    );
    expect(rows[0].ngo_name).toBe('First Org');
    expect(rows[0].ngo_url).toBe('first.org');

    // Resume again with different details → must NOT overwrite.
    await POST(req({ email, org_name: 'Second Org', org_url: 'second.org' }));
    ({ rows } = await query<{ ngo_name: string; ngo_url: string }>(
      `SELECT ngo_name, ngo_url FROM sessions WHERE id = $1`,
      [session_id],
    ));
    expect(rows[0].ngo_name).toBe('First Org');
    expect(rows[0].ngo_url).toBe('first.org');
  });

  afterAll(async () => { await pool().end(); });
});
