import { describe, it, expect, afterAll, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import 'dotenv/config';

// One case per chunk so the local loop vs Vercel-one-chunk behaviour is observable.
process.env.EVAL_CHUNK_BUDGET_MS = '0';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com', isSystem: false } }),
}));

// Capture the after() callback so the test can run (and await) the background drain
// that POST schedules — the real handler does not await it.
let afterCb: null | (() => Promise<void>) = null;
vi.mock('next/server', async (importActual) => {
  const actual = await importActual<typeof import('next/server')>();
  return { ...actual, after: (fn: () => Promise<void>) => { afterCb = fn; } };
});

const fakeCases = [
  { id: 'rd_a', bucket: 'guardrails', input: 'a', expected: {}, judge: ['exact-match'] },
  { id: 'rd_b', bucket: 'guardrails', input: 'b', expected: {}, judge: ['exact-match'] },
  { id: 'rd_c', bucket: 'guardrails', input: 'c', expected: {}, judge: ['exact-match'] },
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

import { query, pool } from '@/lib/db/client';
import { getEvalRun } from '@/lib/db/queries/eval-runs';
import { POST } from '@/app/api/admin/eval-runs/route';

async function postRun(): Promise<string> {
  afterCb = null;
  const res = await POST(new Request('http://localhost/api/admin/eval-runs', { method: 'POST' }));
  expect(res.status).toBe(202);
  return (await res.json()).id as string;
}

describe('POST /api/admin/eval-runs drain kick', () => {
  beforeAll(async () => {
    // Isolate the global claim — no other run should be drainable during this test.
    await query(`UPDATE dalgo_eval_runs SET status='failed' WHERE status IN ('pending','running')`);
  });
  beforeEach(() => { runCaseMock.mockClear(); });
  afterEach(() => { delete process.env.VERCEL; });
  afterAll(async () => {
    await query(`DELETE FROM dalgo_eval_runs WHERE triggered_by = 'admin@example.com'`);
    await pool().end();
  });

  it('local dev (no cron): drains the whole run to completion in-process', async () => {
    delete process.env.VERCEL;
    const id = await postRun();
    expect((await getEvalRun(id))?.status).toBe('pending'); // enqueued, drain not yet run
    expect(afterCb).toBeTypeOf('function');

    await afterCb!(); // run the scheduled background drain loop

    const run = await getEvalRun(id);
    expect(run?.status).toBe('succeeded');
    expect(run?.next_offset).toBe(3);
    expect(run?.passed_count).toBe(3);
    expect(runCaseMock).toHaveBeenCalledTimes(3);
  });

  it('on Vercel: does only one chunk, leaving the rest to the cron', async () => {
    process.env.VERCEL = '1';
    const id = await postRun();

    await afterCb!();

    const run = await getEvalRun(id);
    expect(run?.status).toBe('running'); // not finished — cron continues
    expect(run?.next_offset).toBe(1); // exactly one case this invocation
    expect(runCaseMock).toHaveBeenCalledTimes(1);
  });
});
