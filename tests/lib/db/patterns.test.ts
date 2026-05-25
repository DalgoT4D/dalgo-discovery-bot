import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { vectorSearchPatterns, lexicalSearchPatterns } from '@/lib/db/queries/patterns';
import { pool, query } from '@/lib/db/client';

const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);

describe('pattern search', () => {
  it.skipIf(!hasOpenAi)('vectorSearchPatterns returns archetypes for an NGO problem statement', async () => {
    const { rows } = await query('SELECT COUNT(*)::int AS c FROM dalgo_problem_patterns');
    if ((rows[0] as { c: number }).c === 0) return;

    const hits = await vectorSearchPatterns("We don't have any data system, everything is in Excel", 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toHaveProperty('archetype');
    expect(hits[0]).toHaveProperty('dalgo_response');
    expect(Array.isArray(hits[0].evidence_urls)).toBe(true);
  });

  it('lexicalSearchPatterns returns archetypes for keyword query', async () => {
    const hits = await lexicalSearchPatterns('Excel', 5);
    expect(Array.isArray(hits)).toBe(true);
  });

  afterAll(async () => { await pool().end(); });
});
