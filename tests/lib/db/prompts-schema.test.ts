import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';

describe('dalgo_prompts schema', () => {
  it('has all 7 seed rows with non-empty content', async () => {
    const expectedKeys = [
      'identity',
      'tools_inventory',
      'rules',
      'consultant_mode',
      'dalgo_vs_3rd_party',
      'fit_assessment',
      'positioning',
    ];
    const { rows } = await query<{ key: string; content: string }>(
      `SELECT key, content FROM dalgo_prompts ORDER BY key`,
    );
    const keys = rows.map((r) => r.key).sort();
    expect(keys).toEqual([...expectedKeys].sort());
    for (const row of rows) {
      expect(row.content.length).toBeGreaterThan(20);
    }
  });

  it('seeded an initial version per prompt in dalgo_prompt_versions', async () => {
    const { rows } = await query<{ prompt_key: string; n: number }>(
      `SELECT prompt_key, COUNT(*)::int AS n
         FROM dalgo_prompt_versions
        GROUP BY prompt_key`,
    );
    expect(rows.length).toBe(7);
    for (const r of rows) {
      expect(r.n).toBeGreaterThanOrEqual(1);
    }
  });

  it('wrong_answer_reports table exists and accepts inserts', async () => {
    const sess = await query<{ id: string }>(
      `INSERT INTO sessions DEFAULT VALUES RETURNING id`,
    );
    const msg = await query<{ id: string }>(
      `INSERT INTO messages (session_id, role, content)
       VALUES ($1, 'assistant', '{"text":"test"}'::jsonb) RETURNING id`,
      [sess.rows[0].id],
    );
    const r = await query<{ id: string }>(
      `INSERT INTO wrong_answer_reports (message_id, reason, retrieval_trace_snap, reported_by)
       VALUES ($1, 'test reason', '{}'::jsonb, 'test@dalgo.org') RETURNING id`,
      [msg.rows[0].id],
    );
    expect(r.rows[0].id).toBeTruthy();
    await query(`DELETE FROM wrong_answer_reports WHERE id = $1`, [r.rows[0].id]);
    await query(`DELETE FROM messages WHERE id = $1`, [msg.rows[0].id]);
    await query(`DELETE FROM sessions WHERE id = $1`, [sess.rows[0].id]);
  });

  afterAll(async () => { await pool().end(); });
});
