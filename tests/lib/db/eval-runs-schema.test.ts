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

  it('FK from run_results to runs uses ON DELETE CASCADE', async () => {
    // Create a throwaway run, append a result, delete the run, verify result is gone
    const { rows: run } = await query<{ id: string }>(
      `INSERT INTO dalgo_eval_runs (status, kind, triggered_by)
       VALUES ('succeeded', 'full', 'schema-test')
       RETURNING id`,
    );
    const runId = run[0].id;
    await query(
      `INSERT INTO dalgo_eval_run_results
         (run_id, case_key, bucket, pass)
       VALUES ($1, 'schema_test_case', 'guardrails', TRUE)`,
      [runId],
    );
    const before = await query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM dalgo_eval_run_results WHERE run_id = $1`,
      [runId],
    );
    expect(before.rows[0].count).toBe(1);
    await query(`DELETE FROM dalgo_eval_runs WHERE id = $1`, [runId]);
    const after = await query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM dalgo_eval_run_results WHERE run_id = $1`,
      [runId],
    );
    expect(after.rows[0].count).toBe(0);
  });

  afterAll(async () => { await pool().end(); });
});
