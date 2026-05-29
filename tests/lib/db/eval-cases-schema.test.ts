import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';

describe('dalgo_eval_cases schema', () => {
  it('table exists with required columns', async () => {
    const { rows } = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'dalgo_eval_cases'
        ORDER BY ordinal_position`,
    );
    const cols = rows.map((r) => r.column_name);
    for (const expected of [
      'id', 'case_key', 'bucket', 'input', 'expected', 'judges',
      'enabled', 'notes', 'created_at', 'updated_at', 'updated_by',
    ]) {
      expect(cols).toContain(expected);
    }
  });

  it('dalgo_eval_case_versions table exists', async () => {
    const { rows } = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'dalgo_eval_case_versions'
        ORDER BY ordinal_position`,
    );
    const cols = rows.map((r) => r.column_name);
    for (const expected of [
      'id', 'case_id', 'case_key', 'bucket', 'input', 'expected', 'judges',
      'enabled', 'notes', 'updated_by', 'updated_at',
    ]) {
      expect(cols).toContain(expected);
    }
  });

  it('case_key has a UNIQUE index', async () => {
    const { rows } = await query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM pg_indexes
        WHERE tablename = 'dalgo_eval_cases'
          AND indexname = 'dalgo_eval_cases_case_key_idx'
          AND indexdef ILIKE '%UNIQUE%case_key%'`,
    );
    expect(rows[0].count).toBe(1);
  });

  it('inserts row with defaults applied', async () => {
    const { rows } = await query<{
      id: string; enabled: boolean; expected: unknown; judges: string[];
      updated_by: string; created_at: Date; updated_at: Date;
    }>(
      `INSERT INTO dalgo_eval_cases (case_key, bucket, input, updated_by)
       VALUES ('test_defaults_${Date.now()}', 'citations', 'test input', 'test')
       RETURNING id, enabled, expected, judges, updated_by, created_at, updated_at`,
    );
    const row = rows[0];
    expect(row.enabled).toBe(true);
    expect(row.expected).toEqual({});
    expect(row.judges).toEqual([]);
    expect(row.updated_by).toBe('test');
    expect(row.created_at).toBeTruthy();
    expect(row.updated_at).toBeTruthy();
    // cleanup
    await query(`DELETE FROM dalgo_eval_cases WHERE id = $1`, [row.id]);
  });

  it('rejects duplicate case_key', async () => {
    const key = `test_unique_${Date.now()}`;
    const { rows } = await query<{ id: string }>(
      `INSERT INTO dalgo_eval_cases (case_key, bucket, input, updated_by)
       VALUES ($1, 'citations', 'a', 'test') RETURNING id`,
      [key],
    );
    await expect(
      query(
        `INSERT INTO dalgo_eval_cases (case_key, bucket, input, updated_by)
         VALUES ($1, 'citations', 'b', 'test')`,
        [key],
      ),
    ).rejects.toThrow();
    await query(`DELETE FROM dalgo_eval_cases WHERE id = $1`, [rows[0].id]);
  });

  it('ON DELETE CASCADE removes versions when parent is deleted', async () => {
    const { rows: parent } = await query<{ id: string }>(
      `INSERT INTO dalgo_eval_cases (case_key, bucket, input, updated_by)
       VALUES ('test_cascade_${Date.now()}', 'citations', 'a', 'test') RETURNING id`,
    );
    const parentId = parent[0].id;
    await query(
      `INSERT INTO dalgo_eval_case_versions
         (case_id, case_key, bucket, input, expected, judges, enabled, updated_by)
       VALUES ($1, 'test_cascade', 'citations', 'v1', '{}'::jsonb, ARRAY[]::text[], TRUE, 'test')`,
      [parentId],
    );
    const before = await query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM dalgo_eval_case_versions WHERE case_id = $1`,
      [parentId],
    );
    expect(before.rows[0].count).toBe(1);
    await query(`DELETE FROM dalgo_eval_cases WHERE id = $1`, [parentId]);
    const after = await query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM dalgo_eval_case_versions WHERE case_id = $1`,
      [parentId],
    );
    expect(after.rows[0].count).toBe(0);
  });

  afterAll(async () => { await pool().end(); });
});
