import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import {
  createEvalRun, updateEvalRun, getEvalRun, listEvalRuns,
  appendEvalRunResult, getEvalRunResults,
} from '@/lib/db/queries/eval-runs';

describe('eval-runs queries', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_runs WHERE triggered_by = 'qrtest'`);
  });

  it('creates and updates a run', async () => {
    const id = await createEvalRun({ kind: 'full', triggered_by: 'qrtest' });
    expect(id).toMatch(/[0-9a-f-]{36}/);

    const row1 = await getEvalRun(id);
    expect(row1?.status).toBe('pending');
    expect(row1?.kind).toBe('full');

    await updateEvalRun(id, { status: 'running', total_cases: 50 });
    const row2 = await getEvalRun(id);
    expect(row2?.status).toBe('running');
    expect(row2?.total_cases).toBe(50);

    await updateEvalRun(id, {
      status: 'succeeded', passed_count: 47, failed_count: 3, finished_at: new Date(),
    });
    const row3 = await getEvalRun(id);
    expect(row3?.status).toBe('succeeded');
    expect(row3?.passed_count).toBe(47);
    expect(row3?.finished_at).toBeTruthy();
  });

  it('appends per-case results and reads them back', async () => {
    const runId = await createEvalRun({ kind: 'full', triggered_by: 'qrtest' });
    await appendEvalRunResult({
      run_id: runId,
      case_id: null,
      case_key: 'qrtest_a',
      bucket: 'citations',
      pass: true,
      judge_results: [{ judge: 'retrieval-judge', pass: true, notes: 'ok' }],
      bot_response: 'A response',
      retrieval_trace: { hits: [] },
      tool_calls: [],
      latency_ms: 1500,
    });
    await appendEvalRunResult({
      run_id: runId,
      case_id: null,
      case_key: 'qrtest_b',
      bucket: 'guardrails',
      pass: false,
      judge_results: [{ judge: 'llm-judge', pass: false, notes: 'missing uncertainty' }],
      bot_response: 'A wrong response',
      retrieval_trace: null,
      tool_calls: [],
      latency_ms: 2000,
    });

    const results = await getEvalRunResults(runId);
    expect(results.length).toBe(2);
    expect(results.find((r) => r.case_key === 'qrtest_a')?.pass).toBe(true);
    expect(results.find((r) => r.case_key === 'qrtest_b')?.pass).toBe(false);
  });

  it('lists runs newest first', async () => {
    const id1 = await createEvalRun({ kind: 'full', triggered_by: 'qrtest' });
    await new Promise((r) => setTimeout(r, 5));
    const id2 = await createEvalRun({ kind: 'single', triggered_by: 'qrtest' });
    const runs = (await listEvalRuns({ limit: 100 })).filter((r) => r.triggered_by === 'qrtest');
    expect(runs[0].id).toBe(id2);
    expect(runs[1].id).toBe(id1);
  });

  afterAll(async () => { await pool().end(); });
});
