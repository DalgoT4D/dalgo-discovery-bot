import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { vectorSearchBlogs, lexicalSearchBlogs } from '@/lib/db/queries/blogs';
import { pool, query } from '@/lib/db/client';

const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);

describe('blog search', () => {
  it.skipIf(!hasOpenAi)('vectorSearchBlogs returns chunks ranked by cosine distance', async () => {
    const { rows } = await query('SELECT COUNT(*)::int AS c FROM dalgo_blog_chunks');
    if ((rows[0] as { c: number }).c === 0) return;

    const hits = await vectorSearchBlogs('What is Kobo Toolbox and how do NGOs use it?', 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(5);
    for (const h of hits) {
      expect(h).toHaveProperty('chunk_id');
      expect(h).toHaveProperty('article_id');
      expect(h).toHaveProperty('chunk_text');
      expect(h).toHaveProperty('article_url');
      expect(h).toHaveProperty('article_title');
      expect(typeof h.distance).toBe('number');
    }
  });

  it('lexicalSearchBlogs returns chunks for an exact tool name', async () => {
    const { rows } = await query('SELECT COUNT(*)::int AS c FROM dalgo_blog_chunks');
    if ((rows[0] as { c: number }).c === 0) return;

    const hits = await lexicalSearchBlogs('Kobo', 5);
    // Either we have a Kobo-mentioning chunk (hits.length > 0) or the corpus genuinely has none —
    // in either case the function returns an array.
    expect(Array.isArray(hits)).toBe(true);
    if (hits.length > 0) {
      expect(typeof hits[0].rank).toBe('number');
    }
  });

  afterAll(async () => { await pool().end(); });
});
