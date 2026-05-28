import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { createEvalRun, appendEvalRunResult } from '@/lib/db/queries/eval-runs';
import { GET } from '@/app/api/admin/eval-runs/[id]/route';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com', isSystem: false } }),
}));

describe('GET /api/admin/eval-runs/[id]', () => {
  let runId: string;
  beforeEach(async () => {
    runId = await createEvalRun({ kind: 'full', triggered_by: 'apirun' });
    await appendEvalRunResult({
      run_id: runId, case_id: null, case_key: 'apirun_a', bucket: 'guardrails',
      pass: true, judge_results: [], bot_response: 'x', retrieval_trace: null,
      tool_calls: [], latency_ms: 100,
    });
  });

  it('returns run + results', async () => {
    const req = new Request(`http://localhost/api/admin/eval-runs/${runId}`);
    const res = await GET(req as unknown as Request, { params: Promise.resolve({ id: runId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.run.id).toBe(runId);
    expect(body.results.length).toBe(1);
    expect(body.results[0].case_key).toBe('apirun_a');
  });

  it('404 on missing run', async () => {
    const fake = '00000000-0000-0000-0000-000000000000';
    const req = new Request(`http://localhost/api/admin/eval-runs/${fake}`);
    const res = await GET(req as unknown as Request, { params: Promise.resolve({ id: fake }) });
    expect(res.status).toBe(404);
  });

  afterAll(async () => { await pool().end(); });
});
