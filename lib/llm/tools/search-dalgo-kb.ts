import { tool } from 'ai';
import { z } from 'zod';
import { searchKb } from '@/lib/db/queries/kb';
import { query } from '@/lib/db/client';
import { emit } from '@/lib/telemetry';

const CATEGORIES = [
  'data_sources',
  'transforms',
  'dashboards',
  'orchestration',
  'ai',
  'sharing',
  'rbac',
  'security',
  'deployment',
  'pricing',
  'mission',
  'stack',
  'limitations',
] as const;

export function searchDalgoKbTool(sessionId: string) {
  return tool({
    description:
      "Search Dalgo's capability knowledge base. Use this BEFORE making any factual claim about Dalgo features, pricing, or limitations.",
    parameters: z.object({
      query: z.string().describe('The capability question to look up'),
      category: z.enum(CATEGORIES).optional(),
      top_k: z.number().int().min(1).max(8).default(4),
    }),
    execute: async ({ query: q, category, top_k }) => {
      const hits = await searchKb(q, category, top_k);
      if (!hits.length || hits[0].score < 0.3) {
        await query(
          'INSERT INTO unanswered_questions (question, session_id) VALUES ($1, $2)',
          [q, sessionId],
        );
      }
      const top = hits[0];
      const isHit = !!top && top.score >= 0.3;
      await emit(
        isHit ? 'kb_hit' : 'kb_miss',
        {
          query: q,
          top_score: top?.score ?? 0,
          top_id: top?.id ?? null,
        },
        sessionId,
      );
      return {
        hits: hits.map((h) => ({
          id: h.id,
          status: h.status,
          question: h.question_variants[0],
          answer: h.canonical_answer,
          ngo_framing: h.ngo_framing,
          evidence: h.evidence,
          score: Math.round(h.score * 100) / 100,
        })),
      };
    },
  });
}
