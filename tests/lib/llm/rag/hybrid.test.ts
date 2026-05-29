import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { runHybridRetrieval } from '@/lib/llm/rag/hybrid';
import { pool, query } from '@/lib/db/client';

const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);

describe('runHybridRetrieval', () => {
  it.skipIf(!hasOpenAi)('returns 6 list groups, each with 3 lists, for 3 rewrites', async () => {
    const { rows } = await query('SELECT COUNT(*)::int AS c FROM dalgo_problem_patterns');
    if ((rows[0] as { c: number }).c === 0) return;

    const result = await runHybridRetrieval({
      problem_query: 'we have no data system',
      capability_query: 'Dalgo onboarding from zero data maturity',
      evidence_query: 'NGO that consolidated scattered data',
    });
    expect(result.kb_vector_lists.length).toBe(3);
    expect(result.pattern_vector_lists.length).toBe(3);
    expect(result.blog_vector_lists.length).toBe(3);
    expect(result.kb_lexical_lists.length).toBe(3);
  });

  afterAll(async () => { await pool().end(); });
});
