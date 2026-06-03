import { describe, it, expect, vi, afterAll, beforeAll } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => ({ user: { email: 'admin@dalgo.org' } })) }));
vi.mock('@/lib/embeddings', () => ({ embed: vi.fn(async () => Array(1536).fill(0)) }));
vi.mock('@/lib/llm/rag/pipeline', () => ({ runPipeline: vi.fn(async () => ({ topPassages: [{ id: 'KBID' }], trace: {} })) }));

let sid: string;
let reportId: number;

beforeAll(async () => {
  const s = await query<{ id: string }>(`INSERT INTO sessions DEFAULT VALUES RETURNING id`);
  sid = s.rows[0].id;
  await query(`INSERT INTO messages (session_id, role, content) VALUES ($1,'user','{"text":"does dalgo do qual?"}'::jsonb)`, [sid]);
  const a = await query<{ id: string }>(`INSERT INTO messages (session_id, role, content) VALUES ($1,'assistant','{"text":"yes"}'::jsonb) RETURNING id`, [sid]);
  const r = await query<{ id: number }>(`INSERT INTO wrong_answer_reports (message_id, reason, reported_by, status) VALUES ($1,'wrong','admin@dalgo.org','pending') RETURNING id`, [a.rows[0].id]);
  reportId = r.rows[0].id;
});

describe('POST resolve', () => {
  it('creates a KB entry, an eval case, and marks the report resolved', async () => {
    const { POST } = await import(`@/app/api/admin/wrong-answers/[id]/resolve/route`);
    const body = {
      action: 'create',
      draft: { category: 'ai', question_variants: ['does dalgo do qual?'], canonical_answer: 'No, not as of now.', status: 'no', evidence: [] },
      add_eval_case: true,
    };
    const req = new Request('http://t', { method: 'POST', body: JSON.stringify(body) });
    const res = await POST(req as any, { params: Promise.resolve({ id: String(reportId) }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.fixed_kb_id).toBeTruthy();

    const rep = await query<{ status: string; fix_kind: string; fixed_kb_id: string }>(`SELECT status, fix_kind, fixed_kb_id FROM wrong_answer_reports WHERE id=$1`, [reportId]);
    expect(rep.rows[0].status).toBe('resolved');
    expect(rep.rows[0].fix_kind).toBe('created');

    const ec = await query<{ c: number }>(`SELECT COUNT(*)::int c FROM dalgo_eval_cases WHERE case_key=$1`, [`wrong-answer-fix-${reportId}`]);
    expect(ec.rows[0].c).toBe(1);

    await query(`DELETE FROM dalgo_eval_cases WHERE case_key=$1`, [`wrong-answer-fix-${reportId}`]);
    await query(`DELETE FROM dalgo_knowledge_base WHERE id=$1`, [rep.rows[0].fixed_kb_id]);
  });

  afterAll(async () => {
    await query(`DELETE FROM sessions WHERE id=$1`, [sid]);
    await pool().end();
  });
});
