import { getEvalCases } from './case-source';
import { runCase, type RunResult } from './runner';
import {
  createEvalRun, updateEvalRun, appendEvalRunResult, getEvalRun,
  claimNextEvalRun, type EvalRunRow,
} from '@/lib/db/queries/eval-runs';
import { getEvalCaseByKey } from '@/lib/db/queries/eval-cases';
import type { EvalCase } from './cases/types';

/**
 * Eval runs are processed as a Postgres-backed queue, not a single long-lived
 * background task — a full suite (~80 cases × several LLM calls) far exceeds any
 * Vercel function's timeout. `startFullRun` only enqueues a `pending` row; the
 * `eval-drain` cron (plus an immediate `after()` kick from the POST route) calls
 * `drainEvalRuns` repeatedly, each invocation running cases until a time budget
 * is hit, then handing the rest to the next tick. Progress + the resume point
 * (`next_offset`) are checkpointed to the row after every case, so a crashed or
 * timed-out chunk resumes exactly where it left off.
 */

// Keep a chunk comfortably under the route's maxDuration (300s), leaving headroom
// for one in-flight case to finish after the budget check. Overridable via env so
// the cron-resume path can be exercised deterministically in tests.
function chunkBudgetMs(): number {
  const v = Number(process.env.EVAL_CHUNK_BUDGET_MS);
  return Number.isFinite(v) && v >= 0 ? v : 210_000;
}

export async function startFullRun(triggeredBy: string): Promise<string> {
  // Enqueue only. createEvalRun inserts with status 'pending'; the drainer claims it.
  return createEvalRun({ kind: 'full', triggered_by: triggeredBy });
}

/** Run one case and persist its result row. Never throws — runner errors become a failed result. */
async function runAndPersistCase(runId: string, c: EvalCase): Promise<RunResult> {
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
  return result;
}

/**
 * Process cases for one claimed run until the time budget is hit or the run finishes.
 * Exported for tests (lets the chunk/resume loop be exercised without the global claim).
 */
export async function processRunChunk(run: EvalRunRow, startMs: number): Promise<{ processed: number; done: boolean }> {
  const cases = await getEvalCases(); // stable order: ORDER BY bucket, case_key
  if (run.total_cases !== cases.length) {
    await updateEvalRun(run.id, { total_cases: cases.length });
  }

  let passed = run.passed_count;
  let failed = run.failed_count;
  let i = run.next_offset;
  let processed = 0;
  const budgetMs = chunkBudgetMs();

  while (i < cases.length) {
    // Bail if the run was cancelled (or otherwise left 'running') mid-chunk — stop
    // burning LLM calls and don't let the loop mark a cancelled run 'succeeded'.
    const cur = await getEvalRun(run.id);
    if (cur?.status !== 'running') return { processed, done: false };
    const result = await runAndPersistCase(run.id, cases[i]);
    if (result.pass) passed++; else failed++;
    i++;
    processed++;
    // Checkpoint after every case: resume point, live counters, and a lease heartbeat.
    await updateEvalRun(run.id, {
      next_offset: i, passed_count: passed, failed_count: failed, locked_at: new Date(),
    });
    // Check the budget AFTER processing so every claimed chunk makes at least one
    // case of progress (a too-small budget can never stall the run). The next cron
    // tick / after() kick resumes from next_offset.
    if (Date.now() - startMs > budgetMs) break;
  }

  const done = i >= cases.length;
  if (done) {
    await updateEvalRun(run.id, {
      status: 'succeeded', passed_count: passed, failed_count: failed,
      finished_at: new Date(), locked_at: null,
    });
  } else {
    // Voluntarily yielded on the time budget — release the lease so the next cron
    // tick continues immediately. (A crash instead leaves locked_at set, so the
    // 5-min stale-lease window in claimNextEvalRun handles recovery without a
    // double-run.)
    await updateEvalRun(run.id, { locked_at: null });
  }
  return { processed, done };
}

export interface DrainResult {
  claimed: boolean;
  runId?: string;
  processed: number;
  done: boolean;
}

/**
 * Claim the next due 'full' run and process one time-bounded chunk of it.
 * Returns `{ claimed: false }` when nothing needs work. Safe to call concurrently
 * (claim uses FOR UPDATE SKIP LOCKED) and repeatedly (resumes via next_offset).
 */
export async function drainEvalRuns(): Promise<DrainResult> {
  const run = await claimNextEvalRun();
  if (!run) return { claimed: false, processed: 0, done: true };

  const startMs = Date.now();
  try {
    const { processed, done } = await processRunChunk(run, startMs);
    return { claimed: true, runId: run.id, processed, done };
  } catch (err) {
    // Record the error but leave status='running' with a now-stale lease so the
    // next tick reclaims and retries from the last checkpoint.
    console.error(`[eval-drain] chunk failed for run ${run.id}:`, err);
    await updateEvalRun(run.id, { error: String(err), locked_at: null });
    return { claimed: true, runId: run.id, processed: 0, done: false };
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
    const result = await runAndPersistCase(runId, target);
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
