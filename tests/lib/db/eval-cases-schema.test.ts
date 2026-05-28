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

  it('case_key is unique across active cases', async () => {
    const { rows } = await query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM pg_indexes
        WHERE tablename = 'dalgo_eval_cases'
          AND indexdef ILIKE '%UNIQUE%case_key%'`,
    );
    expect(rows[0].count).toBeGreaterThanOrEqual(1);
  });

  afterAll(async () => { await pool().end(); });
});
