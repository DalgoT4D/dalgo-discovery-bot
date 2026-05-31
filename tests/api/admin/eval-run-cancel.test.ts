import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';

process.env.EVAL_CHUNK_BUDGET_MS = '0'; // one case per chunk → cancel can land mid-run

const fakeCases = [
  { id: 'cx_a', bucket: 'guardrails', input: 'a', expected: {}, judge: ['exact-match'] },
  { id: 'cx_b', bucket: 'guardrails', input: 'b', expected: {}, judge: ['exact-match'] },
  { id: 'cx_c', bucket: 'guardrails', input: 'c', expected: {}, judge: ['exact-match'] },
];
const runCaseMock = vi.fn(async (c: { id: string; bucket: string }) => ({
  id: c.id, bucket: c.bucket, pass: true,
  judgeResults: [{ pass: true }], botResponse: 'stub',
  retrievalTrace: null, toolCalls: [], latencyMs: 1,
}));
vi.mock('@/lib/llm/eval/runner', () => ({ runCase: (c: unknown) => runCaseMock(c as never) }));
vi.mock('@/lib/llm/eval/case-source', () => ({
  getEvalCases: async () => fakeCases,
  __resetForTests: () => {},
}));
vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com', isSystem: false } }),
}));

import { query, pool } from '@/lib/db/client';
import { createEvalRun, getEvalRun, cancelEvalRun } from '@/lib/db/queries/eval-runs';
import { processRunChunk } from '@/lib/llm/eval/run-service';
import { POST as cancelRoute } from '@/app/api/admin/eval-runs/[id]/cancel/route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('eval run cancellation', () => {
  beforeAll(async () => {
    await query(`UPDATE dalgo_eval_runs SET status='failed' WHERE status IN ('pending','running')`);
  });
  beforeEach(() => { runCaseMock.mockClear(); });
  afterAll(async () => {
    await query(`DELETE FROM dalgo_eval_runs WHERE triggered_by = 'canceltest'`);
    await pool().end();
  });

  it('cancelEvalRun cancels a pending run and is a no-op on a terminal one', async () => {
    const id = await createEvalRun({ kind: 'full', triggered_by: 'canceltest' });
    expect(await cancelEvalRun(id)).toBe(true);
    const run = await getEvalRun(id);
    expect(run?.status).toBe('cancelled');
    expect(run?.finished_at).not.toBeNull();
    // already terminal → no-op
    expect(await cancelEvalRun(id)).toBe(false);
  });

  it('POST /cancel route cancels via the handler', async () => {
    const id = await createEvalRun({ kind: 'full', triggered_by: 'canceltest' });
    const res = await cancelRoute(new Request('http://x', { method: 'POST' }), ctx(id));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, cancelled: true });
    expect((await getEvalRun(id))?.status).toBe('cancelled');
  });

  it('the drainer bails mid-run when cancelled and never marks it succeeded', async () => {
    const id = await createEvalRun({ kind: 'full', triggered_by: 'canceltest' });

    // First chunk: claim + process exactly one case (budget=0), run still 'running'.
    await query(`UPDATE dalgo_eval_runs SET status='running', locked_at=now() WHERE id=$1`, [id]);
    let run = await getEvalRun(id);
    let r = await processRunChunk(run!, Date.now());
    expect(r).toMatchObject({ processed: 1, done: false });
    expect((await getEvalRun(id))?.next_offset).toBe(1);

    // Admin cancels. Next drain attempt must process zero cases and leave it cancelled.
    await cancelEvalRun(id);
    runCaseMock.mockClear();
    run = await getEvalRun(id);
    // simulate the drainer re-entering on this row
    r = await processRunChunk({ ...run!, status: 'running' }, Date.now());
    expect(r).toMatchObject({ processed: 0, done: false });
    expect(runCaseMock).not.toHaveBeenCalled();

    const final = await getEvalRun(id);
    expect(final?.status).toBe('cancelled'); // NOT succeeded
    expect(final?.next_offset).toBe(1); // didn't advance past where it was cancelled
  });
});
