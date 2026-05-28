import { getEvalCases } from './case-source';
import { runCase, type RunResult } from './runner';
import {
  createEvalRun, updateEvalRun, appendEvalRunResult, getEvalRun,
} from '@/lib/db/queries/eval-runs';
import { getEvalCaseByKey } from '@/lib/db/queries/eval-cases';

export async function startFullRun(triggeredBy: string): Promise<string> {
  const runId = await createEvalRun({ kind: 'full', triggered_by: triggeredBy });
  // Fire-and-forget; the function continues in the background.
  setImmediate(() => { void executeFullRun(runId); });
  return runId;
}

async function executeFullRun(runId: string): Promise<void> {
  try {
    await updateEvalRun(runId, { status: 'running' });
    const cases = await getEvalCases();
    await updateEvalRun(runId, { total_cases: cases.length });

    let passed = 0;
    let failed = 0;

    for (const c of cases) {
      let result: RunResult;
      try {
        result = await runCase(c);
      } catch (err) {
        result = {
          id: c.id, bucket: c.bucket, pass: false,
          judgeResults: [{ pass: false, notes: `runner error: ${String(err)}` }],
          botResponse: undefined, retrievalTrace: null, toolCalls: [], latencyMs: 0,
        };
      }
      const caseRow = await getEvalCaseByKey(c.id);
      await appendEvalRunResult({
        run_id: runId,
        case_id: caseRow?.id ?? null,
        case_key: c.id,
        bucket: c.bucket,
        pass: result.pass,
        judge_results: result.judgeResults,
        bot_response: result.botResponse ?? null,
        retrieval_trace: result.retrievalTrace ?? null,
        tool_calls: result.toolCalls ?? [],
        latency_ms: result.latencyMs ?? 0,
      });
      if (result.pass) passed++; else failed++;
      // Live progress: update counters as we go
      await updateEvalRun(runId, { passed_count: passed, failed_count: failed });
    }

    await updateEvalRun(runId, {
      status: 'succeeded', passed_count: passed, failed_count: failed,
      finished_at: new Date(),
    });
  } catch (err) {
    await updateEvalRun(runId, {
      status: 'failed', error: String(err), finished_at: new Date(),
    });
  }
}

export async function runSingleCaseNow(caseKey: string, triggeredBy: string): Promise<RunResult> {
  const runId = await createEvalRun({ kind: 'single', triggered_by: triggeredBy });
  await updateEvalRun(runId, { status: 'running', total_cases: 1 });
  const cases = await getEvalCases();
  const target = cases.find((c) => c.id === caseKey);
  if (!target) {
    await updateEvalRun(runId, { status: 'failed', error: `unknown case: ${caseKey}`, finished_at: new Date() });
    throw new Error(`unknown case: ${caseKey}`);
  }

  try {
    const result = await runCase(target);
    const caseRow = await getEvalCaseByKey(target.id);
    await appendEvalRunResult({
      run_id: runId,
      case_id: caseRow?.id ?? null,
      case_key: target.id,
      bucket: target.bucket,
      pass: result.pass,
      judge_results: result.judgeResults,
      bot_response: result.botResponse ?? null,
      retrieval_trace: result.retrievalTrace ?? null,
      tool_calls: result.toolCalls ?? [],
      latency_ms: result.latencyMs ?? 0,
    });
    await updateEvalRun(runId, {
      status: 'succeeded',
      passed_count: result.pass ? 1 : 0,
      failed_count: result.pass ? 0 : 1,
      finished_at: new Date(),
    });
    return result;
  } catch (err) {
    await updateEvalRun(runId, { status: 'failed', error: String(err), finished_at: new Date() });
    throw err;
  }
}

// Re-export getEvalRun so callers don't need a second import path
export { getEvalRun };
