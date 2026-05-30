import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';
import { searchDalgoDocsTool } from '@/lib/llm/tools/search-dalgo-docs';

const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);

describe('searchDalgoDocsTool', () => {
  it.skipIf(!hasOpenAi)('returns hits with page_url + chunk_text for a real query', async () => {
    const { rows } = await query<{ c: number }>('SELECT COUNT(*)::int AS c FROM dalgo_doc_chunks');
    if (rows[0].c === 0) return;

    const tool = searchDalgoDocsTool('test-session');
    const out = (await tool.execute(
      { query: 'how do I create a dashboard?', top_k: 3 },
      { toolCallId: 't', messages: [] },
    )) as { hits: Array<{ page_url: string; chunk_text: string; score: number }> };

    expect(out.hits.length).toBeGreaterThan(0);
    expect(out.hits[0].page_url).toMatch(/^https:\/\/.+\/docs\//);
    expect(out.hits[0].chunk_text.length).toBeGreaterThan(0);
  });
});

afterAll(async () => { await pool().end(); });
