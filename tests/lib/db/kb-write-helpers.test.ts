import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { pool, withClient, query } from '@/lib/db/client';
import { insertKbEntryTx, versionAndUpdateKbTx } from '@/lib/db/queries/kb';

const vec = `[${Array(1536).fill(0).join(',')}]`;

describe('kb write helpers', () => {
  it('insertKbEntryTx creates an entry with provenance', async () => {
    const id = await withClient((c) => insertKbEntryTx(c, {
      category: 'ai', question_variants: ['q1'], canonical_answer: 'a1', status: 'no',
      ngo_framing: null, evidence: [], notes_for_sales: null,
      embeddingLiteral: vec, source: 'wrong_answer_fix', source_message_id: null, author_email: 'a@b.com',
    }));
    const { rows } = await query(`SELECT source, status FROM dalgo_knowledge_base WHERE id=$1`, [id]);
    expect(rows[0].source).toBe('wrong_answer_fix');
    expect(rows[0].status).toBe('no');
    await query(`DELETE FROM dalgo_knowledge_base WHERE id=$1`, [id]);
  });

  it('versionAndUpdateKbTx snapshots prior + updates', async () => {
    const id = await withClient((c) => insertKbEntryTx(c, {
      category: 'ai', question_variants: ['q'], canonical_answer: 'old', status: 'yes',
      ngo_framing: null, evidence: [], notes_for_sales: null,
      embeddingLiteral: vec, source: 'admin_manual', source_message_id: null, author_email: 'a@b.com',
    }));
    await withClient((c) => versionAndUpdateKbTx(c, id, {
      question_variants: ['q'], canonical_answer: 'new', status: 'no',
    }, 'a@b.com', vec));
    const cur = await query<{ canonical_answer: string; status: string }>(`SELECT canonical_answer, status FROM dalgo_knowledge_base WHERE id=$1`, [id]);
    expect(cur.rows[0].canonical_answer).toBe('new');
    const ver = await query<{ c: number; canonical_answer: string }>(
      `SELECT COUNT(*) OVER ()::int c, canonical_answer FROM dalgo_kb_versions WHERE kb_id=$1`, [id]);
    expect(ver.rows[0].c).toBe(1);
    expect(ver.rows[0].canonical_answer).toBe('old'); // version captured PRIOR content
    await query(`DELETE FROM dalgo_knowledge_base WHERE id=$1`, [id]);
  });

  afterAll(async () => { await pool().end(); });
});
