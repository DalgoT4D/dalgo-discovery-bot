import { tool } from 'ai';
import { z } from 'zod';
import { vectorSearchDocs, lexicalSearchDocs } from '@/lib/db/queries/docs';
import { fuseRrf } from '@/lib/llm/rag/rrf';
import { emit } from '@/lib/telemetry';

export function searchDalgoDocsTool(sessionId: string) {
  return tool({
    description:
      "Search the official Dalgo product documentation (dalgot4d.github.io/dalgo_docs). Use this for HOW-TO / configuration / mechanics questions: how to set up X, where a setting lives, what a feature actually does step-by-step. Returns chunks with the doc page URL — always cite it so the user can read more.",
    parameters: z.object({
      query: z.string().describe('What to look up in the product docs'),
      top_k: z.number().int().min(1).max(8).default(4),
    }),
    execute: async ({ query: q, top_k }) => {
      const [vec, lex] = await Promise.all([
        vectorSearchDocs(q, 20),
        lexicalSearchDocs(q, 20),
      ]);
      const fused = fuseRrf({
        lists: [
          vec.map((h) => ({ id: h.chunk_id, source: 'doc', ...h })),
          lex.map((h) => ({ id: h.chunk_id, source: 'doc', ...h })),
        ],
        topK: top_k,
      });
      await emit('doc_search', { query: q, count: fused.length }, sessionId);
      return {
        hits: fused.map((f) => ({
          id: f.item.id,
          page_url: (f.item as { page_url: string }).page_url,
          page_title: (f.item as { page_title: string }).page_title,
          chunk_text: (f.item as { chunk_text: string }).chunk_text,
          score: Math.round(f.score * 1000) / 1000,
        })),
      };
    },
  });
}
