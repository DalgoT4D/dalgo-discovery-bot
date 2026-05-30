import { describe, it, expect, afterAll, beforeEach, afterEach } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { createEvalCase } from '@/lib/db/queries/eval-cases';
import { __resetForTests as resetCases } from '@/lib/llm/eval/case-source';
import { startFullRun, runSingleCaseNow, drainEvalRuns } from '@/lib/llm/eval/run-service';
import { getEvalRun, getEvalRunResults } from '@/lib/db/queries/eval-runs';

describe('run-service', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_cases WHERE case_key LIKE 'svc_%'`);
    await query(`DELETE FROM dalgo_eval_runs WHERE triggered_by = 'svctest'`);
    resetCases();
  });

  it('runSingleCaseNow returns a complete RunResult', async () => {
    await createEvalCase({
      case_key: 'svc_single', bucket: 'guardrails',
      input: 'What is two plus two?',
      expected: { must_express_uncertainty: true },
      judges: ['llm-judge'], enabled: true, notes: null, updated_by: 'test',
    });
    const result = await runSingleCaseNow('svc_single', 'svctest');
    expect(result.id).toBe('svc_single');
    expect(typeof result.pass).toBe('boolean');
    expect(Array.isArray(result.judgeResults)).toBe(true);
    // A run row should be created with kind='single'
    const { rows } = await query<{ id: string; kind: string }>(
      `SELECT id, kind FROM dalgo_eval_runs WHERE triggered_by = 'svctest' AND kind = 'single'`,
    );
    expect(rows.length).toBe(1);
  }, 90_000);

  describe('startFullRun (with seeded cases disabled)', () => {
    beforeEach(async () => {
      // Disable the 50 seeded cases to keep the full-run test bounded to our 2.
      await query(`UPDATE dalgo_eval_cases SET enabled = FALSE WHERE case_key NOT LIKE 'svc_%'`);
      resetCases();
    });

    afterEach(async () => {
      await query(`UPDATE dalgo_eval_cases SET enabled = TRUE WHERE case_key NOT LIKE 'svc_%'`);
      resetCases();
    });

    it('startFullRun enqueues a pending run that the drainer processes to completion', async () => {
      await createEvalCase({
        case_key: 'svc_fa', bucket: 'guardrails',
        input: 'off-topic', expected: { must_express_uncertainty: true },
        judges: ['llm-judge'], enabled: true, notes: null, updated_by: 'test',
      });
      await createEvalCase({
        case_key: 'svc_fb', bucket: 'guardrails',
        input: 'another off-topic', expected: { must_express_uncertainty: true },
        judges: ['llm-judge'], enabled: true, notes: null, updated_by: 'test',
      });
      resetCases();

      const t0 = Date.now();
      const runId = await startFullRun('svctest');
      const elapsed = Date.now() - t0;
      expect(elapsed).toBeLessThan(2000); // enqueue only — returns instantly, no blocking

      // It's queued, not yet executed.
      expect((await getEvalRun(runId))?.status).toBe('pending');

      // Drain the queue the way the cron does — repeatedly, until the run finishes.
      const deadline = Date.now() + 240_000;
      let run = await getEvalRun(runId);
      while (run && run.status !== 'succeeded' && run.status !== 'failed' && Date.now() < deadline) {
        await drainEvalRuns();
        run = await getEvalRun(runId);
      }
      expect(run?.status).toBe('succeeded');
      expect(run?.total_cases).toBeGreaterThanOrEqual(2);
      expect(run?.next_offset).toBe(run?.total_cases);

      const results = await getEvalRunResults(runId);
      const ourCases = results.filter((r) => r.case_key.startsWith('svc_'));
      expect(ourCases.length).toBe(2);
    }, 300_000);
  });

  afterAll(async () => { await pool().end(); });
});
