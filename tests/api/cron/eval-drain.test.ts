import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';

// Force one case per chunk so we exercise the real cron-tick resume path, and pin
// a known cron secret for the auth assertions.
process.env.EVAL_CHUNK_BUDGET_MS = '0';
process.env.CRON_SECRET = 'test-cron-secret';

// Mock the LLM bits; the queue/claim/chunk logic and DB writes are real.
const fakeCases = [
  { id: 'cron_a', bucket: 'guardrails', input: 'a', expected: {}, judge: ['exact-match'] },
  { id: 'cron_b', bucket: 'guardrails', input: 'b', expected: {}, judge: ['exact-match'] },
  { id: 'cron_c', bucket: 'guardrails', input: 'c', expected: {}, judge: ['exact-match'] },
];
const runCaseMock = vi.fn(async (c: { id: string; bucket: string }) => ({
  id: c.id, bucket: c.bucket, pass: c.id !== 'cron_b',
  judgeResults: [{ pass: c.id !== 'cron_b' }],
  botResponse: 'stub', retrievalTrace: null, toolCalls: [], latencyMs: 1,
}));
vi.mock('@/lib/llm/eval/runner', () => ({ runCase: (c: unknown) => runCaseMock(c as never) }));
vi.mock('@/lib/llm/eval/case-source', () => ({
  getEvalCases: async () => fakeCases,
  __resetForTests: () => {},
}));

import { NextRequest } from 'next/server';
import { query, pool } from '@/lib/db/client';
import { createEvalRun, getEvalRun } from '@/lib/db/queries/eval-runs';
import { GET } from '@/app/api/cron/eval-drain/route';

const url = 'http://localhost/api/cron/eval-drain';
const authed = () =>
  new NextRequest(url, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });

describe('/api/cron/eval-drain', () => {
  beforeAll(async () => {
    // Isolate the global claim: no other run should be claimable during this test.
    await query(`UPDATE dalgo_eval_runs SET status = 'failed' WHERE status IN ('pending', 'running')`);
  });
  // Braces matter: mockClear() returns the spy, and a function returned from
  // beforeEach is treated by vitest as a teardown callback (it would call the spy).
  beforeEach(() => { runCaseMock.mockClear(); });
  afterAll(async () => {
    await query(`DELETE FROM dalgo_eval_runs WHERE triggered_by = 'cron_drain_test'`);
    await pool().end();
  });

  it('rejects requests without the cron secret', async () => {
    const res = await GET(new NextRequest(url));
    expect(res.status).toBe(403);
  });

  it('rejects requests with a wrong cron secret', async () => {
    const res = await GET(new NextRequest(url, { headers: { authorization: 'Bearer nope' } }));
    expect(res.status).toBe(403);
  });

  it('returns claimed=false when the queue is empty', async () => {
    const res = await GET(authed());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, claimed: false });
  });

  it('drains a queued run one case per tick across multiple ticks, then completes', async () => {
    const runId = await createEvalRun({ kind: 'full', triggered_by: 'cron_drain_test' });
    expect((await getEvalRun(runId))?.status).toBe('pending');

    // Tick 1 → processes exactly cron_a, run still running, offset 1.
    let body = await (await GET(authed())).json();
    expect(body).toMatchObject({ claimed: true, runId, processed: 1, done: false });
    expect(runCaseMock).toHaveBeenCalledTimes(1);
    let run = await getEvalRun(runId);
    expect(run?.status).toBe('running');
    expect(run?.next_offset).toBe(1);
    expect(run?.passed_count).toBe(1);

    // Tick 2 → cron_b (fails).
    runCaseMock.mockClear();
    body = await (await GET(authed())).json();
    expect(body).toMatchObject({ claimed: true, runId, processed: 1, done: false });
    run = await getEvalRun(runId);
    expect(run?.next_offset).toBe(2);
    expect(run?.failed_count).toBe(1);

    // Tick 3 → cron_c, run finishes.
    runCaseMock.mockClear();
    body = await (await GET(authed())).json();
    expect(body).toMatchObject({ claimed: true, runId, processed: 1, done: true });
    run = await getEvalRun(runId);
    expect(run?.status).toBe('succeeded');
    expect(run?.next_offset).toBe(3);
    expect(run?.total_cases).toBe(3);
    expect(run?.passed_count).toBe(2);
    expect(run?.failed_count).toBe(1);
    expect(run?.finished_at).not.toBeNull();
    expect(run?.locked_at).toBeNull();

    // Tick 4 → nothing left to claim.
    body = await (await GET(authed())).json();
    expect(body).toMatchObject({ claimed: false });

    // Exactly 3 result rows, one per case, no duplicates from re-runs.
    const { rows } = await query<{ case_key: string }>(
      `SELECT case_key FROM dalgo_eval_run_results WHERE run_id = $1 ORDER BY id`, [runId],
    );
    expect(rows.map((r) => r.case_key)).toEqual(['cron_a', 'cron_b', 'cron_c']);
  });
});
