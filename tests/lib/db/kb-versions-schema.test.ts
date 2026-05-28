import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';

describe('dalgo_kb_versions schema', () => {
  it('table exists with required columns', async () => {
    const { rows } = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'dalgo_kb_versions'
        ORDER BY ordinal_position`,
    );
    const cols = rows.map((r) => r.column_name);
    for (const c of [
      'id', 'kb_id', 'category', 'question_variants', 'canonical_answer',
      'status', 'ngo_framing', 'evidence', 'notes_for_sales',
      'updated_by', 'updated_at',
    ]) {
      expect(cols).toContain(c);
    }
  });

  it('has an index on (kb_id, updated_at DESC)', async () => {
    const { rows } = await query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM pg_indexes
        WHERE tablename = 'dalgo_kb_versions'
          AND indexname = 'dalgo_kb_versions_kb_id_idx'`,
    );
    expect(rows[0].count).toBe(1);
  });

  it('ON DELETE CASCADE removes versions when parent kb row is deleted', async () => {
    // Insert a throwaway KB row
    const { rows: kb } = await query<{ id: string }>(
      `INSERT INTO dalgo_knowledge_base
         (category, question_variants, canonical_answer, status, source)
       VALUES ('data_sources', ARRAY['cascade-q'], 'cascade-a', 'yes', 'admin_manual')
       RETURNING id`,
    );
    const kbId = kb[0].id;
    // Insert a version row
    await query(
      `INSERT INTO dalgo_kb_versions
         (kb_id, category, question_variants, canonical_answer, updated_by)
       VALUES ($1, 'data_sources', ARRAY['cascade-q'], 'cascade-a', 'test')`,
      [kbId],
    );
    const before = await query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM dalgo_kb_versions WHERE kb_id = $1`,
      [kbId],
    );
    expect(before.rows[0].count).toBe(1);
    // Delete the parent
    await query(`DELETE FROM dalgo_knowledge_base WHERE id = $1`, [kbId]);
    const after = await query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM dalgo_kb_versions WHERE kb_id = $1`,
      [kbId],
    );
    expect(after.rows[0].count).toBe(0);
  });

  afterAll(async () => { await pool().end(); });
});
