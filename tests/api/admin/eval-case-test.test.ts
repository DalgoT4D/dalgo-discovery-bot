import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { createEvalCase } from '@/lib/db/queries/eval-cases';
import { __resetForTests as resetCases } from '@/lib/llm/eval/case-source';
import { POST } from '@/app/api/admin/eval-cases/[id]/test/route';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com', isSystem: false } }),
}));

describe('POST /api/admin/eval-cases/[id]/test', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_cases WHERE case_key LIKE 'tstnow_%'`);
    resetCases();
  });

  it('runs a single case and returns result', async () => {
    const dbId = await createEvalCase({
      case_key: 'tstnow_one', bucket: 'guardrails',
      input: 'off-topic test', expected: { must_express_uncertainty: true },
      judges: ['llm-judge'], enabled: true, notes: null, updated_by: 'test',
    });
    const req = new Request(`http://localhost/api/admin/eval-cases/${dbId}/test`, { method: 'POST' });
    const res = await POST(req as unknown as Request, { params: Promise.resolve({ id: dbId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.id).toBe('tstnow_one');
    expect(typeof body.result.pass).toBe('boolean');
    expect(Array.isArray(body.result.judgeResults)).toBe(true);
  }, 90_000);

  it('404 for missing case', async () => {
    const fake = '00000000-0000-0000-0000-000000000000';
    const req = new Request(`http://localhost/api/admin/eval-cases/${fake}/test`, { method: 'POST' });
    const res = await POST(req as unknown as Request, { params: Promise.resolve({ id: fake }) });
    expect(res.status).toBe(404);
  });

  afterAll(async () => { await pool().end(); });
});
