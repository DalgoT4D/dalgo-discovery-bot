import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { insertKbVersion } from '@/lib/db/queries/kb-versions';
import { GET } from '@/app/api/admin/kb/[id]/versions/route';
import { POST as RESTORE_POST } from '@/app/api/admin/kb/[id]/versions/[versionId]/restore/route';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com' } }),
}));

async function createKb(): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO dalgo_knowledge_base
       (category, question_variants, canonical_answer, status, source)
     VALUES ('data_sources', ARRAY['cur q'], 'current answer', 'yes', 'admin_manual')
     RETURNING id`,
  );
  return rows[0].id;
}

describe('versions API', () => {
  let kbId: string;
  let versionId: number;
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_knowledge_base WHERE canonical_answer LIKE 'current%' OR canonical_answer LIKE 'old%' OR canonical_answer LIKE 'restored%'`);
    kbId = await createKb();
    await insertKbVersion(kbId, {
      category: 'data_sources',
      question_variants: ['old q'],
      canonical_answer: 'old answer',
      status: 'yes',
      ngo_framing: null,
      evidence: [],
      notes_for_sales: null,
      updated_by: 'seed',
    });
    const { rows } = await query<{ id: number }>(
      `SELECT id FROM dalgo_kb_versions WHERE kb_id = $1 ORDER BY id DESC LIMIT 1`,
      [kbId],
    );
    versionId = rows[0].id;
  });

  it('GET versions returns history', async () => {
    const req = new Request(`http://localhost/api/admin/kb/${kbId}/versions`);
    const res = await GET(req as unknown as Request, { params: Promise.resolve({ id: kbId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versions.length).toBeGreaterThanOrEqual(1);
    expect(body.versions[0].canonical_answer).toBe('old answer');
  });

  it('POST restore copies version onto current row + re-embeds', async () => {
    const req = new Request(
      `http://localhost/api/admin/kb/${kbId}/versions/${versionId}/restore`,
      { method: 'POST' },
    );
    const res = await RESTORE_POST(req as unknown as Request, {
      params: Promise.resolve({ id: kbId, versionId: String(versionId) }),
    });
    expect(res.status).toBe(200);
    const { rows } = await query<{ canonical_answer: string; embedding: unknown }>(
      `SELECT canonical_answer, embedding FROM dalgo_knowledge_base WHERE id = $1`,
      [kbId],
    );
    expect(rows[0].canonical_answer).toBe('old answer');
    expect(rows[0].embedding).toBeTruthy();
  }, 30_000);

  afterAll(async () => { await pool().end(); });
});
