import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';

const SID = '00000000-0000-0000-0000-0000000000b1';

describe('wrong_answer_reports lifecycle columns', () => {
  it('accepts suggested_answer + status + resolution columns and defaults status=pending', async () => {
    await query(`INSERT INTO sessions (id) VALUES ($1) ON CONFLICT DO NOTHING`, [SID]);
    const m = await query<{ id: string }>(
      `INSERT INTO messages (session_id, role, content) VALUES ($1,'assistant','{"text":"x"}'::jsonb) RETURNING id`,
      [SID],
    );
    const r = await query<{ status: string }>(
      `INSERT INTO wrong_answer_reports (message_id, reason, suggested_answer, reported_by)
       VALUES ($1,'wrong','should say Y','a@b.com') RETURNING status`,
      [m.rows[0].id],
    );
    expect(r.rows[0].status).toBe('pending');

    const u = await query<{ status: string; fix_kind: string }>(
      `UPDATE wrong_answer_reports
          SET status='resolved', fix_kind='created', resolved_by='a@b.com', resolved_at=now()
        WHERE message_id=$1 RETURNING status, fix_kind`,
      [m.rows[0].id],
    );
    expect(u.rows[0].status).toBe('resolved');
    expect(u.rows[0].fix_kind).toBe('created');

    await query(`DELETE FROM sessions WHERE id=$1`, [SID]); // cascades report+message
  });

  it('allows wrong_answer_fix as a KB source value', async () => {
    const k = await query<{ id: string }>(
      `INSERT INTO dalgo_knowledge_base
         (category, question_variants, canonical_answer, status, source, embedding)
       VALUES ('ai', ARRAY['q'], 'a', 'no', 'wrong_answer_fix', $1::vector) RETURNING id`,
      [`[${Array(1536).fill(0).join(',')}]`],
    );
    expect(k.rows[0].id).toBeTruthy();
    await query(`DELETE FROM dalgo_knowledge_base WHERE id=$1`, [k.rows[0].id]);
  });

  afterAll(async () => { await pool().end(); });
});
