import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import {
  createEvalCase, getEvalCase, getEvalCaseByKey, listEvalCases,
  updateEvalCase, deleteEvalCase, listEvalCaseVersions,
} from '@/lib/db/queries/eval-cases';

describe('eval-cases queries', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_cases WHERE case_key LIKE 'qtest_%'`);
  });

  it('creates and reads a case', async () => {
    const id = await createEvalCase({
      case_key: 'qtest_basic',
      bucket: 'citations',
      input: 'Does Dalgo support X?',
      expected: { must_cite_one_of: ['https://example.com'] },
      judges: ['retrieval-judge'],
      enabled: true,
      notes: 'created by test',
      updated_by: 'test@example.com',
    });
    expect(id).toMatch(/[0-9a-f-]{36}/);

    const row = await getEvalCase(id);
    expect(row?.case_key).toBe('qtest_basic');
    expect(row?.bucket).toBe('citations');
    expect(row?.expected).toEqual({ must_cite_one_of: ['https://example.com'] });
    expect(row?.judges).toEqual(['retrieval-judge']);
  });

  it('looks up by case_key', async () => {
    await createEvalCase({
      case_key: 'qtest_lookup',
      bucket: 'guardrails',
      input: 'x',
      expected: {},
      judges: ['llm-judge'],
      enabled: true,
      notes: null,
      updated_by: 'test',
    });
    const row = await getEvalCaseByKey('qtest_lookup');
    expect(row?.bucket).toBe('guardrails');
  });

  it('list filters by bucket and enabled', async () => {
    await createEvalCase({ case_key: 'qtest_a', bucket: 'structure', input: 'a', expected: {}, judges: ['llm-judge'], enabled: true, notes: null, updated_by: 'test' });
    await createEvalCase({ case_key: 'qtest_b', bucket: 'structure', input: 'b', expected: {}, judges: ['llm-judge'], enabled: false, notes: null, updated_by: 'test' });

    const all = await listEvalCases({ bucket: 'structure' });
    const keys = all.map((r) => r.case_key).filter((k) => k.startsWith('qtest_'));
    expect(keys).toContain('qtest_a');
    expect(keys).toContain('qtest_b');

    const enabledOnly = await listEvalCases({ bucket: 'structure', enabledOnly: true });
    const enabledKeys = enabledOnly.map((r) => r.case_key).filter((k) => k.startsWith('qtest_'));
    expect(enabledKeys).toContain('qtest_a');
    expect(enabledKeys).not.toContain('qtest_b');
  });

  it('update writes a version row and bumps updated_at', async () => {
    const id = await createEvalCase({
      case_key: 'qtest_versioned', bucket: 'citations', input: 'v1',
      expected: {}, judges: ['retrieval-judge'], enabled: true, notes: null, updated_by: 'test',
    });
    await updateEvalCase(id, {
      input: 'v2',
      expected: { must_cite_one_of: ['https://x'] },
      judges: ['retrieval-judge', 'llm-judge'],
      enabled: true,
      notes: 'rev2',
      updated_by: 'test',
    });
    const after = await getEvalCase(id);
    expect(after?.input).toBe('v2');
    expect(after?.judges.length).toBe(2);

    const versions = await listEvalCaseVersions(id);
    // initial create writes v1 + update writes v2 = 2 rows
    expect(versions.length).toBe(2);
    expect(versions[0].input).toBe('v2'); // newest first
    expect(versions[1].input).toBe('v1');
  });

  it('delete removes the case', async () => {
    const id = await createEvalCase({
      case_key: 'qtest_del', bucket: 'citations', input: 'x', expected: {},
      judges: ['retrieval-judge'], enabled: true, notes: null, updated_by: 'test',
    });
    await deleteEvalCase(id);
    const row = await getEvalCase(id);
    expect(row).toBeNull();
  });

  it('updateEvalCase throws for unknown id', async () => {
    await expect(
      updateEvalCase('00000000-0000-0000-0000-000000000000', {
        input: 'never',
        updated_by: 'test',
      }),
    ).rejects.toThrow(/not found/);
  });

  it('failed create rolls back the version row', async () => {
    // First create succeeds: 1 version row exists for qtest_rollback
    const firstId = await createEvalCase({
      case_key: 'qtest_rollback', bucket: 'citations', input: 'first',
      expected: {}, judges: ['retrieval-judge'], enabled: true, notes: null,
      updated_by: 'test',
    });
    // Second create with the same case_key MUST fail (unique violation)
    await expect(
      createEvalCase({
        case_key: 'qtest_rollback', bucket: 'citations', input: 'second',
        expected: {}, judges: ['retrieval-judge'], enabled: true, notes: null,
        updated_by: 'test',
      }),
    ).rejects.toThrow();
    // Verify no orphan version row was committed — should still be exactly 1
    const versions = await listEvalCaseVersions(firstId);
    expect(versions.length).toBe(1);
    expect(versions[0].input).toBe('first');
  });

  afterAll(async () => { await pool().end(); });
});
