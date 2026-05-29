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
    `SELECT * FROM dalgo_eval_runs ORDER BY started_at DESC, id DESC LIMIT $1`,
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
    `SELECT * FROM dalgo_eval_run_results WHERE run_id = $1 ORDER BY created_at ASC, id ASC`,
    [runId],
  );
  return rows;
}
