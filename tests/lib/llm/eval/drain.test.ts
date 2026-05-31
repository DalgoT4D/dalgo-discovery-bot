import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';

// Mock the LLM-hitting bits so the test is fast and free; the queue/chunk logic
// and the DB writes are exercised for real.
const fakeCases = [
  { id: 'drain_a', bucket: 'guardrails', input: 'a', expected: {}, judge: ['exact-match'] },
  { id: 'drain_b', bucket: 'guardrails', input: 'b', expected: {}, judge: ['exact-match'] },
  { id: 'drain_c', bucket: 'guardrails', input: 'c', expected: {}, judge: ['exact-match'] },
];

const runCaseMock = vi.fn(async (c: { id: string; bucket: string }) => ({
  id: c.id,
  bucket: c.bucket,
  pass: c.id !== 'drain_b', // a,c pass; b fails
  judgeResults: [{ pass: c.id !== 'drain_b' }],
  botResponse: 'stub',
  retrievalTrace: null,
  toolCalls: [],
  latencyMs: 1,
}));

vi.mock('@/lib/llm/eval/runner', () => ({ runCase: (c: unknown) => runCaseMock(c as never) }));
vi.mock('@/lib/llm/eval/case-source', () => ({
  getEvalCases: async () => fakeCases,
  __resetForTests: () => {},
}));

import { query, pool } from '@/lib/db/client';
import { createEvalRun, getEvalRun } from '@/lib/db/queries/eval-runs';
import { processRunChunk } from '@/lib/llm/eval/run-service';

// startMs must be ~now: processRunChunk breaks the loop once Date.now() - startMs
// exceeds the chunk budget, so pass the real current time to process all 3 cases.
const now = () => Date.now();

describe('eval drain loop (processRunChunk)', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_runs WHERE triggered_by = 'draintest'`);
    runCaseMock.mockClear();
  });

  afterAll(async () => {
    await query(`DELETE FROM dalgo_eval_runs WHERE triggered_by = 'draintest'`);
    await pool().end();
  });

  it('processes all cases, records counts, and marks the run succeeded', async () => {
    const runId = await createEvalRun({ kind: 'full', triggered_by: 'draintest' });
    // processRunChunk is only ever called on a claimed (running) run.
    await query(`UPDATE dalgo_eval_runs SET status='running' WHERE id = $1`, [runId]);
    const run = await getEvalRun(runId);
    const { processed, done } = await processRunChunk(run!, now());

    expect(processed).toBe(3);
    expect(done).toBe(true);
    expect(runCaseMock).toHaveBeenCalledTimes(3);

    const after = await getEvalRun(runId);
    expect(after?.status).toBe('succeeded');
    expect(after?.total_cases).toBe(3);
    expect(after?.passed_count).toBe(2);
    expect(after?.failed_count).toBe(1);
    expect(after?.next_offset).toBe(3);
    expect(after?.finished_at).not.toBeNull();

    const { rows } = await query<{ n: string }>(
      `SELECT count(*) AS n FROM dalgo_eval_run_results WHERE run_id = $1`, [runId],
    );
    expect(Number(rows[0].n)).toBe(3);
  });

  it('resumes from next_offset without re-running earlier cases', async () => {
    const runId = await createEvalRun({ kind: 'full', triggered_by: 'draintest' });
    // Simulate a claimed run mid-flight: case 0 (drain_a) already done.
    await query(
      `UPDATE dalgo_eval_runs SET status='running', next_offset = 1, passed_count = 1, total_cases = 3 WHERE id = $1`,
      [runId],
    );
    const run = await getEvalRun(runId);
    const { processed, done } = await processRunChunk(run!, now());

    expect(processed).toBe(2); // only drain_b, drain_c
    expect(done).toBe(true);
    expect(runCaseMock).toHaveBeenCalledTimes(2);
    const calledIds = runCaseMock.mock.calls.map((c) => (c[0] as { id: string }).id);
    expect(calledIds).toEqual(['drain_b', 'drain_c']); // NOT drain_a again

    const after = await getEvalRun(runId);
    expect(after?.status).toBe('succeeded');
    expect(after?.passed_count).toBe(2); // 1 carried + drain_c
    expect(after?.failed_count).toBe(1); // drain_b
    expect(after?.next_offset).toBe(3);
  });

  it('marks an already-complete run succeeded without running any case', async () => {
    const runId = await createEvalRun({ kind: 'full', triggered_by: 'draintest' });
    await query(`UPDATE dalgo_eval_runs SET next_offset = 3, total_cases = 3 WHERE id = $1`, [runId]);
    const run = await getEvalRun(runId);
    const { processed, done } = await processRunChunk(run!, now());

    expect(processed).toBe(0);
    expect(done).toBe(true);
    expect(runCaseMock).not.toHaveBeenCalled();
    const after = await getEvalRun(runId);
    expect(after?.status).toBe('succeeded');
  });
});
