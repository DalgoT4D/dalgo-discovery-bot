import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import {
  insertKbVersion, listKbVersions, getKbVersion,
} from '@/lib/db/queries/kb-versions';

async function createTestKbRow(): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO dalgo_knowledge_base
       (category, question_variants, canonical_answer, status, source, updated_at)
     VALUES ('data_sources', ARRAY['v1 q'], 'v1 answer', 'yes', 'admin_manual', NOW())
     RETURNING id`,
  );
  return rows[0].id;
}

describe('kb-versions queries', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_knowledge_base WHERE canonical_answer LIKE 'v_ test%' OR canonical_answer LIKE 'v1 answer'`);
  });

  it('inserts and lists versions newest first', async () => {
    const kbId = await createTestKbRow();
    await insertKbVersion(kbId, {
      category: 'data_sources',
      question_variants: ['q1'],
      canonical_answer: 'v_ test 1',
      status: 'yes',
      ngo_framing: null,
      evidence: [],
      notes_for_sales: null,
      updated_by: 'test',
    });
    await insertKbVersion(kbId, {
      category: 'data_sources',
      question_variants: ['q1', 'q2'],
      canonical_answer: 'v_ test 2',
      status: 'yes',
      ngo_framing: null,
      evidence: [],
      notes_for_sales: null,
      updated_by: 'test',
    });

    const versions = await listKbVersions(kbId);
    expect(versions.length).toBe(2);
    // Newest first with id DESC tiebreaker for same-ms inserts
    expect(versions[0].canonical_answer).toBe('v_ test 2');
    expect(versions[1].canonical_answer).toBe('v_ test 1');

    const v = await getKbVersion(versions[1].id);
    expect(v?.canonical_answer).toBe('v_ test 1');
  });

  afterAll(async () => { await pool().end(); });
});
