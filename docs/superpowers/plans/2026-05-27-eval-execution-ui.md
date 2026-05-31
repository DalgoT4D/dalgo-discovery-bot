# Eval execution UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build admin UI to trigger eval runs ("Run full eval suite" + per-case "Test this case now"), watch them complete asynchronously, and drill into per-failure diagnostics (query, bot response, judge results, retrieved KB, tool calls).

**Architecture:** Two new tables — `dalgo_eval_runs` (one row per run) + `dalgo_eval_run_results` (one row per case×run). Eval execution is moved out of test files into a callable service (`lib/llm/eval/run-service.ts`). Runs are kicked off via POST endpoint that returns a `run_id` immediately and executes in a `setImmediate`-scheduled async task that writes results progressively to the DB. UI polls run status every 2 seconds. A single-case "Test now" endpoint runs synchronously (~10 seconds).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, raw `pg` Pool, NextAuth v5, Tailwind v4.

**Spec:** This plan is the spec.

**Branch:** `feat/blog-ingestion` (continue commits; do NOT push to remote without explicit user instruction).

**Pre-flight expectations:**
- **Plan 1 (eval cases DB + admin UI) MUST be merged first.** This plan reads from `dalgo_eval_cases` via `getEvalCases()`.
- Postgres container `dalgo-discovery-db` up; apply migrations via `docker exec -i dalgo-discovery-db psql ...`.
- `.env.local` has `DATABASE_URL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.
- Single test: `npm test -- tests/lib/llm/eval/run-service.test.ts`
- All tests: `npm test`
- Existing reference: blog refresh job pattern at `app/api/admin/blogs/refresh/` is the closest model for async-with-polling.

---

## File Structure

**Create:**
- `lib/db/queries/eval-runs.ts` — typed CRUD for runs + results
- `lib/llm/eval/run-service.ts` — callable runner (replaces test-only invocation)
- `scripts/migrations/004_eval_runs.sql` — schema migration
- `app/api/admin/eval-runs/route.ts` — POST (start) + GET (list)
- `app/api/admin/eval-runs/[id]/route.ts` — GET (status + results)
- `app/api/admin/eval-cases/[id]/test/route.ts` — POST (run single case synchronously)
- `app/admin/evals/runs/page.tsx` — runs history list
- `app/admin/evals/runs/[id]/page.tsx` — single run detail with drill-down
- `components/admin/eval-run-progress.tsx` — polling progress widget
- `components/admin/eval-result-drilldown.tsx` — per-case failure detail card
- `components/admin/test-case-button.tsx` — "Test this case now" button + result modal
- Tests for service, queries, API

**Modify:**
- `lib/db/schema.sql` — append the two new tables
- `lib/llm/eval/runner.ts` — extract `runCase()` so the service can call it; keep existing exports intact (for back-compat with the test file)
- `app/admin/evals/page.tsx` — add "Run full eval suite" button + recent runs sidebar
- `app/admin/evals/[id]/page.tsx` — add "Test this case now" button

---

## Task 1: Schema + migration for runs + results

**Files:**
- Modify: `lib/db/schema.sql`
- Create: `scripts/migrations/004_eval_runs.sql`
- Test: `tests/lib/db/eval-runs-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Create `tests/lib/db/eval-runs-schema.test.ts`:

```typescript
import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';

describe('eval runs schema', () => {
  it('dalgo_eval_runs table has required columns', async () => {
    const { rows } = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'dalgo_eval_runs' ORDER BY ordinal_position`,
    );
    const cols = rows.map((r) => r.column_name);
    for (const c of [
      'id', 'status', 'kind', 'triggered_by', 'total_cases', 'passed_count',
      'failed_count', 'started_at', 'finished_at', 'error',
    ]) {
      expect(cols).toContain(c);
    }
  });

  it('dalgo_eval_run_results table has required columns', async () => {
    const { rows } = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'dalgo_eval_run_results' ORDER BY ordinal_position`,
    );
    const cols = rows.map((r) => r.column_name);
    for (const c of [
      'id', 'run_id', 'case_id', 'case_key', 'bucket', 'pass',
      'judge_results', 'bot_response', 'retrieval_trace', 'tool_calls',
      'latency_ms', 'created_at',
    ]) {
      expect(cols).toContain(c);
    }
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `npm test -- tests/lib/db/eval-runs-schema.test.ts`
Expected: FAIL (tables don't exist).

- [ ] **Step 3: Create migration**

Create `scripts/migrations/004_eval_runs.sql`:

```sql
-- 004_eval_runs.sql
-- Tables for eval run history and per-case results.

CREATE TABLE IF NOT EXISTS dalgo_eval_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status        text NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  kind          text NOT NULL CHECK (kind IN ('full', 'single')),
  triggered_by  text NOT NULL,
  total_cases   int NOT NULL DEFAULT 0,
  passed_count  int NOT NULL DEFAULT 0,
  failed_count  int NOT NULL DEFAULT 0,
  started_at    timestamptz NOT NULL DEFAULT NOW(),
  finished_at   timestamptz,
  error         text
);

CREATE INDEX IF NOT EXISTS dalgo_eval_runs_started_at_idx
  ON dalgo_eval_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS dalgo_eval_run_results (
  id               bigserial PRIMARY KEY,
  run_id           uuid NOT NULL REFERENCES dalgo_eval_runs(id) ON DELETE CASCADE,
  case_id          uuid REFERENCES dalgo_eval_cases(id) ON DELETE SET NULL,
  case_key         text NOT NULL,
  bucket           text NOT NULL,
  pass             boolean NOT NULL,
  judge_results    jsonb NOT NULL DEFAULT '[]'::jsonb,
  bot_response     text,
  retrieval_trace  jsonb,
  tool_calls       jsonb,
  latency_ms       int,
  created_at       timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dalgo_eval_run_results_run_id_idx
  ON dalgo_eval_run_results(run_id);

CREATE INDEX IF NOT EXISTS dalgo_eval_run_results_case_id_idx
  ON dalgo_eval_run_results(case_id);
```

- [ ] **Step 4: Apply the migration**

Run: `docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery < scripts/migrations/004_eval_runs.sql`
Expected: `CREATE TABLE`, `CREATE INDEX` notices, no errors.

- [ ] **Step 5: Append identical DDL to `lib/db/schema.sql`**

Append the same `CREATE TABLE` / `CREATE INDEX` statements from migration 004 into `lib/db/schema.sql`, under a comment header:

```sql
-- ============================================================
-- Eval runs (migration 004 — kept in sync with this schema file)
-- ============================================================
```

(Copy-paste from migration 004.)

- [ ] **Step 6: Run test to confirm pass**

Run: `npm test -- tests/lib/db/eval-runs-schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/migrations/004_eval_runs.sql lib/db/schema.sql tests/lib/db/eval-runs-schema.test.ts
git commit -m "feat(eval): schema for eval runs and per-case results"
```

---

## Task 2: Queries layer for runs and results

**Files:**
- Create: `lib/db/queries/eval-runs.ts`
- Test: `tests/lib/db/eval-runs.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/lib/db/eval-runs.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm test -- tests/lib/db/eval-runs.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

Create `lib/db/queries/eval-runs.ts`:

```typescript
import { query } from '@/lib/db/client';

export type EvalRunStatus = 'pending' | 'running' | 'succeeded' | 'failed';
export type EvalRunKind = 'full' | 'single';

export interface EvalRunRow {
  id: string;
  status: EvalRunStatus;
  kind: EvalRunKind;
  triggered_by: string;
  total_cases: number;
  passed_count: number;
  failed_count: number;
  started_at: Date;
  finished_at: Date | null;
  error: string | null;
}

export interface EvalRunResultRow {
  id: number;
  run_id: string;
  case_id: string | null;
  case_key: string;
  bucket: string;
  pass: boolean;
  judge_results: unknown[];
  bot_response: string | null;
  retrieval_trace: unknown;
  tool_calls: unknown;
  latency_ms: number | null;
  created_at: Date;
}

export async function createEvalRun(input: { kind: EvalRunKind; triggered_by: string }): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO dalgo_eval_runs (status, kind, triggered_by)
     VALUES ('pending', $1, $2) RETURNING id`,
    [input.kind, input.triggered_by],
  );
  return rows[0].id;
}

export interface EvalRunUpdate {
  status?: EvalRunStatus;
  total_cases?: number;
  passed_count?: number;
  failed_count?: number;
  finished_at?: Date | null;
  error?: string | null;
}

export async function updateEvalRun(id: string, patch: EvalRunUpdate): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  function add(col: string, val: unknown) { params.push(val); sets.push(`${col} = $${params.length}`); }
  if (patch.status !== undefined) add('status', patch.status);
  if (patch.total_cases !== undefined) add('total_cases', patch.total_cases);
  if (patch.passed_count !== undefined) add('passed_count', patch.passed_count);
  if (patch.failed_count !== undefined) add('failed_count', patch.failed_count);
  if (patch.finished_at !== undefined) add('finished_at', patch.finished_at);
  if (patch.error !== undefined) add('error', patch.error);
  if (sets.length === 0) return;
  params.push(id);
  await query(`UPDATE dalgo_eval_runs SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
}

export async function getEvalRun(id: string): Promise<EvalRunRow | null> {
  const { rows } = await query<EvalRunRow>(`SELECT * FROM dalgo_eval_runs WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listEvalRuns(opts: { limit?: number } = {}): Promise<EvalRunRow[]> {
  const { rows } = await query<EvalRunRow>(
    `SELECT * FROM dalgo_eval_runs ORDER BY started_at DESC LIMIT $1`,
    [opts.limit ?? 50],
  );
  return rows;
}

export interface AppendResult {
  run_id: string;
  case_id: string | null;
  case_key: string;
  bucket: string;
  pass: boolean;
  judge_results: unknown[];
  bot_response: string | null;
  retrieval_trace: unknown;
  tool_calls: unknown;
  latency_ms: number;
}

export async function appendEvalRunResult(input: AppendResult): Promise<void> {
  await query(
    `INSERT INTO dalgo_eval_run_results
       (run_id, case_id, case_key, bucket, pass, judge_results, bot_response,
        retrieval_trace, tool_calls, latency_ms)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9::jsonb, $10)`,
    [
      input.run_id, input.case_id, input.case_key, input.bucket, input.pass,
      JSON.stringify(input.judge_results), input.bot_response,
      input.retrieval_trace !== null ? JSON.stringify(input.retrieval_trace) : null,
      JSON.stringify(input.tool_calls), input.latency_ms,
    ],
  );
}

export async function getEvalRunResults(runId: string): Promise<EvalRunResultRow[]> {
  const { rows } = await query<EvalRunResultRow>(
    `SELECT * FROM dalgo_eval_run_results WHERE run_id = $1 ORDER BY created_at ASC`,
    [runId],
  );
  return rows;
}
```

- [ ] **Step 4: Run test to confirm pass**

Run: `npm test -- tests/lib/db/eval-runs.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/eval-runs.ts tests/lib/db/eval-runs.test.ts
git commit -m "feat(eval): queries for eval runs and per-case results"
```

---

## Task 3: Refactor runner.ts — extract callable `runCase`

**Files:**
- Modify: `lib/llm/eval/runner.ts`

The existing `runner.ts` has internal logic for executing one case. We need to expose it cleanly so the service in Task 4 can call it directly. Goal: minimal disruption — existing `runOne`/`runAll` stay; we just expose `runCase(c: EvalCase)` as a named export.

- [ ] **Step 1: Identify the current per-case execution**

Read `lib/llm/eval/runner.ts`. Find the function that runs one `EvalCase` and produces a `RunResult`. (Likely already named `runCase` or inlined into `runOne`.) Note its signature and the shape it returns.

- [ ] **Step 2: Export `runCase` cleanly with full trace capture**

The current `RunResult` shape is `{ id, bucket, pass, judgeResults }`. We need to extend it to capture `bot_response`, `retrieval_trace`, `tool_calls`, and `latency_ms` for the UI drill-down.

Modify `lib/llm/eval/runner.ts`:

Add (or update) a `RunResult` interface:

```typescript
export interface RunResult {
  id: string;
  bucket: string;
  pass: boolean;
  judgeResults: JudgeResult[];
  // New fields for UI drill-down:
  botResponse?: string;
  retrievalTrace?: unknown;
  toolCalls?: unknown;
  latencyMs?: number;
}
```

Update the inner per-case runner (probably called inside `runOne`) to capture:
- The bot's final text response (from the LLM synthesis)
- The retrieval trace returned by `runPipeline()`
- Any tool-call data your runner already tracks
- A timing measurement (Date.now before/after)

Export the per-case function:

```typescript
export async function runCase(c: EvalCase): Promise<RunResult> {
  const t0 = Date.now();
  // existing logic: runPipeline → synthesizeAnswer → dispatch judges
  // ...capture trace, answer, tool calls...
  const latencyMs = Date.now() - t0;
  return {
    id: c.id,
    bucket: c.bucket,
    pass: judgeResults.every((j) => j.pass),
    judgeResults,
    botResponse: synthesizedAnswer,
    retrievalTrace: trace,
    toolCalls: toolCalls,
    latencyMs,
  };
}
```

If the existing code already exports `runCase`, just extend the result shape to include the new fields. If not, define it.

Keep `runOne(id)` and `runAll()` as before, calling `runCase` internally.

- [ ] **Step 3: Run existing eval test to confirm no regression**

Run: `npm test -- tests/lib/llm/eval/runner-uses-db.test.ts`
Expected: PASS. The test from Plan 1 still works.

Run: `npm run eval`
Expected: passes at the same rate as before.

- [ ] **Step 4: Commit**

```bash
git add lib/llm/eval/runner.ts
git commit -m "refactor(eval): expose runCase with full trace capture"
```

---

## Task 4: The async run service

**Files:**
- Create: `lib/llm/eval/run-service.ts`
- Test: `tests/lib/llm/eval/run-service.test.ts`

This is the heart of the feature. The service:
- Provides `startFullRun(triggeredBy)` → creates a run row + kicks off async execution + returns `run_id`
- Provides `runSingleCaseNow(caseKey, triggeredBy)` → synchronous (~10s) single-case run that returns full result

- [ ] **Step 1: Write the failing test**

Create `tests/lib/llm/eval/run-service.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { createEvalCase } from '@/lib/db/queries/eval-cases';
import { __resetForTests as resetCases } from '@/lib/llm/eval/case-source';
import { startFullRun, runSingleCaseNow } from '@/lib/llm/eval/run-service';
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

  it('startFullRun returns immediately and completes in background', async () => {
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

    const t0 = Date.now();
    const runId = await startFullRun('svctest');
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(2000); // returns quickly

    // Poll for completion
    const deadline = Date.now() + 180_000;
    let run = await getEvalRun(runId);
    while (run && run.status !== 'succeeded' && run.status !== 'failed' && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));
      run = await getEvalRun(runId);
    }
    expect(run?.status).toBe('succeeded');
    expect(run?.total_cases).toBeGreaterThanOrEqual(2);

    const results = await getEvalRunResults(runId);
    const ourCases = results.filter((r) => r.case_key.startsWith('svc_'));
    expect(ourCases.length).toBe(2);
  }, 240_000);

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run test to confirm fail**

Run: `npm test -- tests/lib/llm/eval/run-service.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the service**

Create `lib/llm/eval/run-service.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to confirm pass**

Run: `npm test -- tests/lib/llm/eval/run-service.test.ts`
Expected: PASS (2 tests). The second test polls for ~minutes against the real LLM.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/eval/run-service.ts tests/lib/llm/eval/run-service.test.ts
git commit -m "feat(eval): run-service with async full-run and sync single-case"
```

---

## Task 5: API — start + list runs

**Files:**
- Create: `app/api/admin/eval-runs/route.ts`
- Test: `tests/api/admin/eval-runs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/admin/eval-runs.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { GET, POST } from '@/app/api/admin/eval-runs/route';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com', isSystem: false } }),
}));

describe('/api/admin/eval-runs', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_runs WHERE triggered_by LIKE 'apitest%'`);
  });

  it('POST creates a pending run and returns id', async () => {
    const req = new Request('http://localhost/api/admin/eval-runs', { method: 'POST' });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.id).toMatch(/[0-9a-f-]{36}/);
    const { rows } = await query<{ status: string }>(
      `SELECT status FROM dalgo_eval_runs WHERE id = $1`, [body.id],
    );
    expect(['pending', 'running']).toContain(rows[0].status);
  });

  it('GET lists runs newest first', async () => {
    await query(
      `INSERT INTO dalgo_eval_runs (status, kind, triggered_by) VALUES
       ('succeeded', 'full', 'apitest1'),
       ('succeeded', 'full', 'apitest2')`,
    );
    const req = new Request('http://localhost/api/admin/eval-runs');
    const res = await GET(req as unknown as Request);
    const body = await res.json();
    const ours = body.runs.filter((r: { triggered_by: string }) => r.triggered_by.startsWith('apitest'));
    expect(ours.length).toBe(2);
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run, expect fail, implement, expect pass**

Run test (FAIL — route missing).

Create `app/api/admin/eval-runs/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { startFullRun } from '@/lib/llm/eval/run-service';
import { listEvalRuns } from '@/lib/db/queries/eval-runs';

export async function POST(_req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = await startFullRun(session.user.email ?? 'admin');
  return NextResponse.json({ id }, { status: 202 });
}

export async function GET(_req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const runs = await listEvalRuns({ limit: 50 });
  return NextResponse.json({ runs });
}
```

Run: `npm test -- tests/api/admin/eval-runs.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/eval-runs/route.ts tests/api/admin/eval-runs.test.ts
git commit -m "feat(eval): admin API to start + list eval runs"
```

---

## Task 6: API — get single run status + results

**Files:**
- Create: `app/api/admin/eval-runs/[id]/route.ts`
- Test: `tests/api/admin/eval-runs-id.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/admin/eval-runs-id.test.ts`:

```typescript
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
```

- [ ] **Step 2: Implement**

Create `app/api/admin/eval-runs/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getEvalRun, getEvalRunResults } from '@/lib/db/queries/eval-runs';

interface Ctx { params: Promise<{ id: string }>; }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const run = await getEvalRun(id);
  if (!run) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const results = await getEvalRunResults(id);
  return NextResponse.json({ run, results });
}
```

- [ ] **Step 3: Run test, expect pass; commit**

```bash
npm test -- tests/api/admin/eval-runs-id.test.ts
git add app/api/admin/eval-runs/[id]/route.ts tests/api/admin/eval-runs-id.test.ts
git commit -m "feat(eval): admin API to fetch run status + per-case results"
```

---

## Task 7: API — single-case "test now"

**Files:**
- Create: `app/api/admin/eval-cases/[id]/test/route.ts`
- Test: `tests/api/admin/eval-case-test.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/admin/eval-case-test.test.ts`:

```typescript
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

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Implement**

Create `app/api/admin/eval-cases/[id]/test/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getEvalCase } from '@/lib/db/queries/eval-cases';
import { runSingleCaseNow } from '@/lib/llm/eval/run-service';

interface Ctx { params: Promise<{ id: string }>; }

export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const row = await getEvalCase(id);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  try {
    const result = await runSingleCaseNow(row.case_key, session.user.email ?? 'admin');
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Run test, commit**

```bash
npm test -- tests/api/admin/eval-case-test.test.ts
git add app/api/admin/eval-cases/[id]/test/route.ts tests/api/admin/eval-case-test.test.ts
git commit -m "feat(eval): admin API to run a single case synchronously"
```

---

## Task 8: UI — "Run full eval suite" button + polling progress widget

**Files:**
- Modify: `app/admin/evals/page.tsx`
- Create: `components/admin/eval-run-progress.tsx`

- [ ] **Step 1: Build the polling progress widget**

Create `components/admin/eval-run-progress.tsx`:

```typescript
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface RunStatus {
  id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  total_cases: number;
  passed_count: number;
  failed_count: number;
  finished_at: string | null;
  error: string | null;
}

export function EvalRunProgress({ runId, onComplete }: { runId: string; onComplete?: () => void }) {
  const [run, setRun] = useState<RunStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const res = await fetch(`/api/admin/eval-runs/${runId}`);
      if (!res.ok) return;
      const { run: r } = await res.json();
      if (cancelled) return;
      setRun(r);
      if (r.status === 'succeeded' || r.status === 'failed') {
        onComplete?.();
        return;
      }
      setTimeout(tick, 2000);
    };
    tick();
    return () => { cancelled = true; };
  }, [runId, onComplete]);

  if (!run) return <p>Loading run…</p>;
  const total = run.total_cases || 1;
  const done = run.passed_count + run.failed_count;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="border rounded p-4 bg-blue-50">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium">Run {run.id.slice(0, 8)}…</span>
        <span className="text-sm capitalize">{run.status}</span>
      </div>
      <div className="w-full bg-gray-200 rounded h-2 overflow-hidden mb-2">
        <div className="bg-blue-600 h-2 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-sm text-gray-700 flex justify-between">
        <span>{done} / {total} cases</span>
        <span>✓ {run.passed_count} · ✗ {run.failed_count}</span>
      </div>
      {run.error && <p className="text-red-600 mt-2">Error: {run.error}</p>}
      {(run.status === 'succeeded' || run.status === 'failed') && (
        <Link href={`/admin/evals/runs/${run.id}`} className="text-blue-600 text-sm underline mt-2 inline-block">
          View full results →
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the Run button to the evals list page**

Modify `app/admin/evals/page.tsx`. Above the existing `<EvalCasesTable />`, add a Run button that calls the API. Convert the page (or this section) to a client component, OR build a small client-only `RunEvalsButton` component.

Create `components/admin/run-evals-button.tsx`:

```typescript
'use client';
import { useState } from 'react';
import { EvalRunProgress } from './eval-run-progress';
import Link from 'next/link';

export function RunEvalsButton() {
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true); setError(null);
    const res = await fetch('/api/admin/eval-runs', { method: 'POST' });
    setStarting(false);
    if (!res.ok) { setError(`HTTP ${res.status}`); return; }
    const { id } = await res.json();
    setRunId(id);
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={start}
          disabled={starting || runId !== null}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {starting ? 'Starting…' : 'Run full eval suite'}
        </button>
        <Link href="/admin/evals/runs" className="text-sm text-blue-600 hover:underline">
          View run history
        </Link>
      </div>
      {error && <p className="text-red-600">Error: {error}</p>}
      {runId && <EvalRunProgress runId={runId} />}
    </div>
  );
}
```

Then modify `app/admin/evals/page.tsx` to include it:

```typescript
import { RunEvalsButton } from '@/components/admin/run-evals-button';
// ...
<RunEvalsButton />
<EvalCasesTable />
```

- [ ] **Step 3: Smoke test in browser**

Run dev server. Visit `/admin/evals`. Click "Run full eval suite." Watch the progress bar tick. After a few minutes the link to results appears.

- [ ] **Step 4: Commit**

```bash
git add components/admin/run-evals-button.tsx components/admin/eval-run-progress.tsx app/admin/evals/page.tsx
git commit -m "feat(eval): Run-full-eval button with live progress widget"
```

---

## Task 9: UI — runs history list page

**Files:**
- Create: `app/admin/evals/runs/page.tsx`

- [ ] **Step 1: Build the page**

Create `app/admin/evals/runs/page.tsx`:

```typescript
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { listEvalRuns } from '@/lib/db/queries/eval-runs';

export default async function RunsHistoryPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const runs = await listEvalRuns({ limit: 50 });

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Eval run history</h1>
      <Link href="/admin/evals" className="text-blue-600 text-sm hover:underline">← back to cases</Link>
      <table className="w-full mt-4 text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4">Started</th>
            <th className="py-2 pr-4">Triggered by</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Kind</th>
            <th className="py-2 pr-4">Pass / Fail</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-b hover:bg-gray-50">
              <td className="py-2 pr-4">{new Date(r.started_at).toLocaleString()}</td>
              <td className="py-2 pr-4">{r.triggered_by}</td>
              <td className="py-2 pr-4">
                <span className={r.status === 'failed' ? 'text-red-600' : ''}>{r.status}</span>
              </td>
              <td className="py-2 pr-4">{r.kind}</td>
              <td className="py-2 pr-4">
                {r.passed_count} ✓ / {r.failed_count} ✗
              </td>
              <td className="py-2">
                <Link href={`/admin/evals/runs/${r.id}`} className="text-blue-600 hover:underline">View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 2: Smoke test**

Visit `/admin/evals/runs`. See your previous runs listed.

- [ ] **Step 3: Commit**

```bash
git add app/admin/evals/runs/page.tsx
git commit -m "feat(eval): runs history list page"
```

---

## Task 10: UI — single run detail page with failure drill-down

**Files:**
- Create: `app/admin/evals/runs/[id]/page.tsx`
- Create: `components/admin/eval-result-drilldown.tsx`

- [ ] **Step 1: Build the drill-down component**

Create `components/admin/eval-result-drilldown.tsx`:

```typescript
'use client';
import { useState } from 'react';

interface ResultRow {
  id: number;
  case_key: string;
  bucket: string;
  pass: boolean;
  judge_results: Array<{ pass: boolean; notes: string; judge?: string }>;
  bot_response: string | null;
  retrieval_trace: unknown;
  tool_calls: unknown;
  latency_ms: number | null;
}

export function EvalResultDrilldown({ result }: { result: ResultRow }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`border rounded p-3 ${result.pass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <button onClick={() => setExpanded((v) => !v)} className="text-left w-full flex justify-between items-start">
        <span className="font-mono text-sm">
          {result.pass ? '✓' : '✗'} {result.case_key}
          <span className="text-gray-500 ml-2">({result.bucket})</span>
        </span>
        <span className="text-gray-500 text-xs">{result.latency_ms}ms · {expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 text-sm">
          <Section title="Judge results">
            <ul className="space-y-1">
              {result.judge_results.map((j, idx) => (
                <li key={idx} className="border-l-2 pl-2" style={{ borderColor: j.pass ? '#16a34a' : '#dc2626' }}>
                  <span className="font-mono">{j.judge ?? `judge ${idx}`}</span>: {j.pass ? '✓' : '✗'} — {j.notes}
                </li>
              ))}
            </ul>
          </Section>

          {result.bot_response && (
            <Section title="Bot response">
              <pre className="whitespace-pre-wrap bg-white border p-2 rounded">{result.bot_response}</pre>
            </Section>
          )}

          {result.retrieval_trace !== null && (
            <Section title="Retrieval trace">
              <pre className="whitespace-pre-wrap bg-white border p-2 rounded text-xs overflow-x-auto">
                {JSON.stringify(result.retrieval_trace, null, 2)}
              </pre>
            </Section>
          )}

          {Array.isArray(result.tool_calls) && result.tool_calls.length > 0 && (
            <Section title="Tool calls">
              <pre className="whitespace-pre-wrap bg-white border p-2 rounded text-xs overflow-x-auto">
                {JSON.stringify(result.tool_calls, null, 2)}
              </pre>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-semibold text-xs uppercase tracking-wide text-gray-600 mb-1">{title}</h4>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Build the run detail page**

Create `app/admin/evals/runs/[id]/page.tsx`:

```typescript
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getEvalRun, getEvalRunResults } from '@/lib/db/queries/eval-runs';
import { EvalResultDrilldown } from '@/components/admin/eval-result-drilldown';

interface PageProps { params: Promise<{ id: string }>; }

export default async function RunDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const { id } = await params;
  const run = await getEvalRun(id);
  if (!run) notFound();
  const results = await getEvalRunResults(id);

  const byBucket = results.reduce<Record<string, { pass: number; fail: number }>>(
    (acc, r) => {
      const b = (acc[r.bucket] ??= { pass: 0, fail: 0 });
      if (r.pass) b.pass++; else b.fail++;
      return acc;
    },
    {},
  );

  return (
    <main className="max-w-6xl mx-auto p-6">
      <Link href="/admin/evals/runs" className="text-blue-600 text-sm hover:underline">← all runs</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Run {id.slice(0, 8)}…</h1>
      <p className="text-sm text-gray-600 mb-6">
        {run.kind} · started {new Date(run.started_at).toLocaleString()} by {run.triggered_by} ·
        status: <strong>{run.status}</strong>
      </p>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {Object.entries(byBucket).map(([bucket, { pass, fail }]) => (
          <div key={bucket} className="border rounded p-3">
            <div className="text-xs uppercase text-gray-500 mb-1">{bucket}</div>
            <div className="text-sm">
              <span className="text-green-700">{pass} ✓</span>
              {' · '}
              <span className="text-red-700">{fail} ✗</span>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Failed cases ({results.filter((r) => !r.pass).length})</h2>
        <div className="space-y-2 mb-8">
          {results.filter((r) => !r.pass).map((r) => (
            <EvalResultDrilldown key={r.id} result={r} />
          ))}
        </div>

        <h2 className="text-lg font-semibold mb-3">Passed cases ({results.filter((r) => r.pass).length})</h2>
        <div className="space-y-2">
          {results.filter((r) => r.pass).map((r) => (
            <EvalResultDrilldown key={r.id} result={r} />
          ))}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Smoke test**

Visit `/admin/evals/runs/<id>` for a completed run. Verify:
- Bucket summary cards show pass/fail counts
- Failed cases section lists each failure
- Clicking a card expands to show judge results, bot response, retrieval trace

- [ ] **Step 4: Commit**

```bash
git add components/admin/eval-result-drilldown.tsx app/admin/evals/runs/[id]/page.tsx
git commit -m "feat(eval): run detail page with per-failure drill-down"
```

---

## Task 11: UI — "Test this case now" button on edit page

**Files:**
- Create: `components/admin/test-case-button.tsx`
- Modify: `app/admin/evals/[id]/page.tsx` (add the button)

- [ ] **Step 1: Build the button + result modal**

Create `components/admin/test-case-button.tsx`:

```typescript
'use client';
import { useState } from 'react';

interface RunResult {
  id: string;
  bucket: string;
  pass: boolean;
  judgeResults: Array<{ pass: boolean; notes: string; judge?: string }>;
  botResponse?: string;
  latencyMs?: number;
}

export function TestCaseButton({ caseId }: { caseId: string }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true); setError(null); setResult(null);
    const res = await fetch(`/api/admin/eval-cases/${caseId}/test`, { method: 'POST' });
    setRunning(false);
    if (!res.ok) { setError(`HTTP ${res.status}`); return; }
    const { result: r } = await res.json();
    setResult(r);
  }

  return (
    <div className="mt-4">
      <button
        onClick={run}
        disabled={running}
        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
      >
        {running ? 'Running case (~10–30s)…' : 'Test this case now'}
      </button>
      {error && <p className="text-red-600 mt-2">Error: {error}</p>}
      {result && (
        <div className={`mt-3 border rounded p-3 ${result.pass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="font-medium">
            {result.pass ? '✓ Pass' : '✗ Fail'} · {result.latencyMs}ms
          </p>
          <ul className="text-sm mt-2 space-y-1">
            {result.judgeResults.map((j, idx) => (
              <li key={idx}>
                <span className="font-mono text-xs">{j.judge ?? `judge ${idx}`}</span>: {j.pass ? '✓' : '✗'} {j.notes}
              </li>
            ))}
          </ul>
          {result.botResponse && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold">Bot response</summary>
              <pre className="whitespace-pre-wrap mt-2 text-sm bg-white border p-2 rounded">{result.botResponse}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the button to the case edit page**

Modify `app/admin/evals/[id]/page.tsx`. Below the `<EvalCaseEditor ... />` and above the version history section, add:

```typescript
import { TestCaseButton } from '@/components/admin/test-case-button';
// ...
<TestCaseButton caseId={id} />
```

- [ ] **Step 3: Smoke test**

Open any case at `/admin/evals/<id>`. Click "Test this case now". Wait ~10–30s. Result appears in a colored panel.

- [ ] **Step 4: Commit**

```bash
git add components/admin/test-case-button.tsx app/admin/evals/[id]/page.tsx
git commit -m "feat(eval): per-case Test-this-case-now button"
```

---

## Task 12: Final verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 3: End-to-end smoke**

In the browser:
1. `/admin/evals` — see cases listed, click "Run full eval suite"
2. Watch progress bar tick to completion
3. Click "View full results" → see drill-down per case
4. Back to `/admin/evals`, click any case → "Test this case now"
5. See immediate result

If all 5 steps work, ship it.

- [ ] **Step 4: Final commit if needed**

```bash
git status
# if anything stray:
git add .
git commit -m "chore(eval): cleanup after execution-UI work"
```

---

## Notes for Plan 3 (KB enhancements)

This plan finishes the eval system fully. Plan 3 will add:
- The paste-text → LLM extracts Q&A → admin reviews → save flow for KB content additions
- Lightweight version history on KB entries (mirror prompts pattern)
- "Restore previous version" button on KB edit page

Those are independent of the eval system — they touch only KB code.
