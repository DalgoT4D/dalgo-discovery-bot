import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { createEvalCase } from '@/lib/db/queries/eval-cases';
import { GET, PUT, DELETE } from '@/app/api/admin/eval-cases/[id]/route';
import { getEvalCases, __resetForTests as resetCaseSourceCache } from '@/lib/llm/eval/case-source';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com', isSystem: false } }),
}));

describe('/api/admin/eval-cases/[id]', () => {
  let id: string;
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_cases WHERE case_key LIKE 'apiid_%'`);
    id = await createEvalCase({
      case_key: 'apiid_target', bucket: 'citations', input: 'x',
      expected: {}, judges: ['retrieval-judge'], enabled: true, notes: null, updated_by: 'seed',
    });
  });

  it('GET returns case', async () => {
    const req = new Request(`http://localhost/api/admin/eval-cases/${id}`);
    const res = await GET(req as unknown as Request, { params: Promise.resolve({ id }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.case.case_key).toBe('apiid_target');
  });

  it('GET 404 for missing', async () => {
    const fake = '00000000-0000-0000-0000-000000000000';
    const req = new Request(`http://localhost/api/admin/eval-cases/${fake}`);
    const res = await GET(req as unknown as Request, { params: Promise.resolve({ id: fake }) });
    expect(res.status).toBe(404);
  });

  it('PUT updates the case', async () => {
    const req = new Request(`http://localhost/api/admin/eval-cases/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: 'updated input', notes: 'rev2' }),
    });
    const res = await PUT(req as unknown as Request, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.case.input).toBe('updated input');
    expect(body.case.notes).toBe('rev2');
    const { rows } = await query<{ input: string; notes: string | null }>(
      `SELECT input, notes FROM dalgo_eval_cases WHERE id = $1`, [id],
    );
    expect(rows[0].input).toBe('updated input');
    expect(rows[0].notes).toBe('rev2');
  });

  it('PUT bucket change invalidates both old and new bucket caches', async () => {
    // Prime caches for both buckets
    resetCaseSourceCache();
    await getEvalCases('citations'); // populate
    await getEvalCases('guardrails'); // populate

    // Move the case from citations → guardrails
    const req = new Request(`http://localhost/api/admin/eval-cases/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bucket: 'guardrails' }),
    });
    const res = await PUT(req as unknown as Request, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);

    // Both caches should now miss when re-fetched (force fresh DB read).
    // The simplest assertion: after the PUT, fetching either bucket should
    // reflect the move — case is no longer in citations, IS in guardrails.
    const citationsCases = await getEvalCases('citations');
    const guardrailsCases = await getEvalCases('guardrails');
    expect(citationsCases.some((c) => c.id === 'apiid_target')).toBe(false);
    expect(guardrailsCases.some((c) => c.id === 'apiid_target')).toBe(true);
  });

  it('DELETE removes the case', async () => {
    const req = new Request(`http://localhost/api/admin/eval-cases/${id}`, { method: 'DELETE' });
    const res = await DELETE(req as unknown as Request, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(204);
    const { rows } = await query(`SELECT id FROM dalgo_eval_cases WHERE id = $1`, [id]);
    expect(rows.length).toBe(0);
  });

  it('DELETE 404 for missing', async () => {
    const fake = '00000000-0000-0000-0000-000000000000';
    const req = new Request(`http://localhost/api/admin/eval-cases/${fake}`, { method: 'DELETE' });
    const res = await DELETE(req as unknown as Request, { params: Promise.resolve({ id: fake }) });
    expect(res.status).toBe(404);
  });

  afterAll(async () => { await pool().end(); });
});
