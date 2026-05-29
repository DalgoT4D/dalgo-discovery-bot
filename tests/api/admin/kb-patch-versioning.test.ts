import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { listKbVersions } from '@/lib/db/queries/kb-versions';
import { PATCH } from '@/app/api/admin/kb/[id]/route';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com', isSystem: false } }),
}));

async function createKb(): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO dalgo_knowledge_base
       (category, question_variants, canonical_answer, status, source)
     VALUES ('data_sources', ARRAY['orig q'], 'orig answer', 'yes', 'admin_manual')
     RETURNING id`,
  );
  return rows[0].id;
}

describe('PATCH /api/admin/kb/[id] writes version snapshot', () => {
  let kbId: string;
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_knowledge_base WHERE canonical_answer LIKE 'orig answer%' OR canonical_answer LIKE 'new answer%'`);
    kbId = await createKb();
  });

  it('inserts a version row capturing the prior state on PATCH', async () => {
    const req = new Request(`http://localhost/api/admin/kb/${kbId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ canonical_answer: 'new answer' }),
    });
    const res = await PATCH(req as unknown as Request, { params: Promise.resolve({ id: kbId }) });
    expect(res.status).toBe(200);

    const versions = await listKbVersions(kbId);
    expect(versions.length).toBe(1);
    expect(versions[0].canonical_answer).toBe('orig answer'); // captured the pre-PATCH state
  }, 30_000); // PATCH triggers re-embed (OpenAI call), allow 30s

  afterAll(async () => { await pool().end(); });
});
