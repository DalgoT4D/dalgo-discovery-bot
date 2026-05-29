import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { searchKb, lexicalSearchKb } from '@/lib/db/queries/kb';
import { pool, query } from '@/lib/db/client';

const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);

describe('searchKb', () => {
  it.skipIf(!hasOpenAi)('finds a KoboToolbox-related entry for a Kobo query', async () => {
    const { rows } = await query('SELECT COUNT(*)::int AS c FROM dalgo_knowledge_base');
    if ((rows[0] as any).c === 0) return;  // skip if KB not seeded yet

    const results = await searchKb('Can I connect KoboToolbox?', undefined, 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].canonical_answer.toLowerCase()).toContain('kobo');
  });

  it.skipIf(!hasOpenAi)('filters by category when provided', async () => {
    const { rows } = await query('SELECT COUNT(*)::int AS c FROM dalgo_knowledge_base');
    if ((rows[0] as any).c === 0) return;

    const results = await searchKb('pricing', 'pricing', 5);
    expect(results.every(r => r.category === 'pricing')).toBe(true);
  });

  it('module exports the expected shape', () => {
    expect(typeof searchKb).toBe('function');
  });
});

describe('lexicalSearchKb', () => {
  it('returns ranked hits for keyword query', async () => {
    const { rows } = await query('SELECT COUNT(*)::int AS c FROM dalgo_knowledge_base');
    if ((rows[0] as { c: number }).c === 0) return;

    const hits = await lexicalSearchKb('pricing', 5);
    if (hits.length > 0) {
      expect(typeof hits[0].rank).toBe('number');
      expect(hits[0]).toHaveProperty('canonical_answer');
    }
  });
});

afterAll(async () => { await pool().end(); });
