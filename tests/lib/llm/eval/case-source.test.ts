import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { createEvalCase, deleteEvalCase } from '@/lib/db/queries/eval-cases';
import {
  getEvalCases, invalidateEvalCaseCache, __resetForTests, __cacheStatsForTests,
} from '@/lib/llm/eval/case-source';

describe('case-source cache', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_cases WHERE case_key LIKE 'csrc_%'`);
    __resetForTests();
  });

  it('returns cases for a bucket', async () => {
    const id = await createEvalCase({
      case_key: 'csrc_one', bucket: 'citations', input: 'x',
      expected: {}, judges: ['retrieval-judge'], enabled: true, notes: null, updated_by: 'test',
    });
    const cases = await getEvalCases('citations');
    expect(cases.some((c) => c.id === 'csrc_one')).toBe(true);
    await deleteEvalCase(id);
  });

  it('caches results within TTL', async () => {
    await createEvalCase({
      case_key: 'csrc_cache', bucket: 'guardrails', input: 'x',
      expected: {}, judges: ['llm-judge'], enabled: true, notes: null, updated_by: 'test',
    });
    await getEvalCases('guardrails');
    const stats1 = __cacheStatsForTests();
    expect(stats1.hits + stats1.misses).toBeGreaterThan(0);
    await getEvalCases('guardrails');
    const stats2 = __cacheStatsForTests();
    expect(stats2.hits).toBeGreaterThan(stats1.hits);
  });

  it('cache invalidation forces a refetch', async () => {
    await createEvalCase({
      case_key: 'csrc_inv', bucket: 'structure', input: 'x',
      expected: {}, judges: ['llm-judge'], enabled: true, notes: null, updated_by: 'test',
    });
    await getEvalCases('structure'); // populate cache
    invalidateEvalCaseCache('structure');
    await getEvalCases('structure');
    const stats = __cacheStatsForTests();
    expect(stats.misses).toBeGreaterThanOrEqual(2);
  });

  it('returns all enabled cases when no bucket given', async () => {
    await createEvalCase({
      case_key: 'csrc_all1', bucket: 'citations', input: 'x',
      expected: {}, judges: ['retrieval-judge'], enabled: true, notes: null, updated_by: 'test',
    });
    await createEvalCase({
      case_key: 'csrc_all2', bucket: 'guardrails', input: 'x',
      expected: {}, judges: ['llm-judge'], enabled: false, notes: null, updated_by: 'test',
    });
    const cases = await getEvalCases();
    const keys = cases.map((c) => c.id);
    expect(keys).toContain('csrc_all1');
    expect(keys).not.toContain('csrc_all2'); // disabled cases excluded
  });

  it('expires cache after TTL window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await createEvalCase({
        case_key: 'csrc_ttl', bucket: 'citations', input: 'x',
        expected: {}, judges: ['retrieval-judge'], enabled: true, notes: null,
        updated_by: 'test',
      });
      await getEvalCases('citations');
      const before = __cacheStatsForTests();

      // Within TTL: hit
      await getEvalCases('citations');
      const within = __cacheStatsForTests();
      expect(within.hits).toBe(before.hits + 1);

      // Past TTL (60s + 1s): miss
      vi.advanceTimersByTime(61_000);
      await getEvalCases('citations');
      const after = __cacheStatsForTests();
      expect(after.misses).toBeGreaterThan(within.misses);
    } finally {
      vi.useRealTimers();
    }
  });

  afterAll(async () => { await pool().end(); });
});
