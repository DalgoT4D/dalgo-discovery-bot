import { tool } from 'ai';
import { z } from 'zod';

/**
 * The assistant calls this at the end of (almost) every reply to give the
 * user 2-4 clickable follow-up suggestions. During a fit assessment these
 * are multiple-choice answers; during normal Q&A they are related follow-up
 * questions. The UI watches for tool calls with this name and renders them
 * as chips under the latest assistant message.
 *
 * execute() does no real work — the structured args ARE the payload.
 */
export function suggestRepliesTool() {
  return tool({
    description:
      'Attach 2-4 short suggested next replies the user might want to click. Use this at the end of nearly every assistant turn — either as related follow-up questions, or as multiple-choice answer options when conducting a fit assessment. Keep each reply under 14 words and phrased from the user\'s perspective ("I use X", "Yes", "Tell me about Y").',
    parameters: z.object({
      replies: z
        .array(z.string().min(1).max(120))
        .min(2)
        .max(4)
        .describe('2-4 short reply suggestions, each a complete sentence or phrase the user can click'),
    }),
    execute: async ({ replies }) => ({ ok: true, count: replies.length }),
  });
}
