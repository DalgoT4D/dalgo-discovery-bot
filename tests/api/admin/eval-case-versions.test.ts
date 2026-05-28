import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { createEvalCase, updateEvalCase } from '@/lib/db/queries/eval-cases';
import { GET } from '@/app/api/admin/eval-cases/[id]/versions/route';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com', isSystem: false } }),
}));

describe('GET versions', () => {
  let id: string;
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_cases WHERE case_key LIKE 'ver_%'`);
    id = await createEvalCase({
      case_key: 'ver_target', bucket: 'citations', input: 'v1',
      expected: {}, judges: ['retrieval-judge'], enabled: true, notes: null, updated_by: 'seed',
    });
    await updateEvalCase(id, { input: 'v2', updated_by: 'seed' });
  });

  it('returns versions newest first', async () => {
    const req = new Request(`http://localhost/api/admin/eval-cases/${id}/versions`);
    const res = await GET(req as unknown as Request, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versions.length).toBe(2);
    expect(body.versions[0].input).toBe('v2');
    expect(body.versions[1].input).toBe('v1');
  });

  it('404 when case does not exist', async () => {
    const fake = '00000000-0000-0000-0000-000000000000';
    const req = new Request(`http://localhost/api/admin/eval-cases/${fake}/versions`);
    const res = await GET(req as unknown as Request, { params: Promise.resolve({ id: fake }) });
    expect(res.status).toBe(404);
  });

  afterAll(async () => { await pool().end(); });
});
