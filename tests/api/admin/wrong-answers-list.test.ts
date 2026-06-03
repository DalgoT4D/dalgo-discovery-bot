import { describe, it, expect, vi, afterAll, beforeAll } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => ({ user: { email: 'admin@dalgo.org' } })) }));

let sid: string;
let messageId: string;

beforeAll(async () => {
  const s = await query<{ id: string }>(`INSERT INTO sessions DEFAULT VALUES RETURNING id`);
  sid = s.rows[0].id;
  await query(`INSERT INTO messages (session_id, role, content) VALUES ($1,'user','{"text":"does dalgo do X?"}'::jsonb)`, [sid]);
  const a = await query<{ id: string }>(`INSERT INTO messages (session_id, role, content) VALUES ($1,'assistant','{"text":"yes"}'::jsonb) RETURNING id`, [sid]);
  messageId = a.rows[0].id;
  await query(`INSERT INTO wrong_answer_reports (message_id, reason, reported_by, status) VALUES ($1,'bad answer','admin@dalgo.org','pending')`, [messageId]);
});

describe('GET /api/admin/wrong-answers', () => {
  it('returns pending reports with message text + session id', async () => {
    const { GET } = await import('@/app/api/admin/wrong-answers/route');
    const req = new Request('http://t/api/admin/wrong-answers?status=pending');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    const row = json.reports.find((r: any) => r.message_id === messageId);
    expect(row).toBeTruthy();
    expect(row.reason).toBe('bad answer');
    expect(row.session_id).toBe(sid);
    expect(typeof row.answer_text).toBe('string');
  });

  afterAll(async () => {
    await query(`DELETE FROM sessions WHERE id=$1`, [sid]);
    await pool().end();
  });
});
