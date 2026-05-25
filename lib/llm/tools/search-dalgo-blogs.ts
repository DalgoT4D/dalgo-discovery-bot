import { tool } from 'ai';
import { z } from 'zod';
import { vectorSearchBlogs, lexicalSearchBlogs } from '@/lib/db/queries/blogs';
import { fuseRrf } from '@/lib/llm/rag/rrf';
import { emit } from '@/lib/telemetry';

export function searchDalgoBlogsTool(sessionId: string) {
  return tool({
    description:
      'Search Dalgo-related blog posts (case studies, customer stories). Use this when an NGO mentions a specific tool (Kobo, DHIS2), a sector (maternal health), or asks "how have others done X". Returns chunks with article URLs to cite.',
    parameters: z.object({
      query: z.string().describe('What to look up in the blog corpus'),
      top_k: z.number().int().min(1).max(8).default(4),
    }),
    execute: async ({ query: q, top_k }) => {
      const [vec, lex] = await Promise.all([
        vectorSearchBlogs(q, 20),
        lexicalSearchBlogs(q, 20),
      ]);
      const fused = fuseRrf({
        lists: [
          vec.map(h => ({ id: h.chunk_id, source: 'blog', ...h })),
          lex.map(h => ({ id: h.chunk_id, source: 'blog', ...h })),
        ],
        topK: top_k,
      });
      await emit('blog_search', { query: q, count: fused.length }, sessionId);
      return {
        hits: fused.map(f => ({
          id: f.item.id,
          article_url: (f.item as any).article_url,
          article_title: (f.item as any).article_title,
          chunk_text: (f.item as any).chunk_text,
          score: Math.round(f.score * 1000) / 1000,
        })),
      };
    },
  });
}
