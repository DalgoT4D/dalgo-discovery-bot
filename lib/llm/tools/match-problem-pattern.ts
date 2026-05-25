import { tool } from 'ai';
import { z } from 'zod';
import { vectorSearchPatterns } from '@/lib/db/queries/patterns';
import { emit } from '@/lib/telemetry';

export function matchProblemPatternTool(sessionId: string) {
  return tool({
    description:
      "Match the NGO's problem statement to a curated 'problem pattern' (archetype). Use this when the user describes a problem in their own words ('we have no system', 'data is scattered'). Returns: archetype, consultant framing, Dalgo response, evidence URLs.",
    parameters: z.object({
      problem_statement: z.string().describe("The NGO's problem in their own words"),
    }),
    execute: async ({ problem_statement }) => {
      const hits = await vectorSearchPatterns(problem_statement, 3);
      const top = hits[0];
      const matched = !!top && (top.distance ?? 1) < 0.4;
      await emit('pattern_match', {
        query: problem_statement,
        matched,
        top_archetype: top?.archetype ?? null,
        top_distance: top?.distance ?? null,
      }, sessionId);
      return {
        matched,
        candidates: hits.map(h => ({
          archetype: h.archetype,
          consultant_framing: h.consultant_framing,
          dalgo_response: h.dalgo_response,
          evidence_urls: h.evidence_urls,
          distance: h.distance,
        })),
      };
    },
  });
}
