import { tool } from 'ai';
import { z } from 'zod';
import { emit } from '@/lib/telemetry';

/**
 * Offer the user a hands-on guest tour of the live Dalgo platform.
 *
 * execute() does no real work — the UI watches for this tool call and renders a
 * "Try the live platform" access card (guest credentials + a button that opens
 * the Dalgo login). The structured args ARE the trigger. We emit telemetry so
 * we can see how often the offer is made.
 */
export function offerGuestTourTool(sessionId: string) {
  return tool({
    description:
      "Offer the user a hands-on guest tour of the LIVE Dalgo platform. Call this when the user shows interest in seeing or trying Dalgo for real — e.g. they ask 'can I see it?', 'how do I get started?', 'can I try it?', they react positively after a fit assessment, or they want a demo of the actual product (not just talk about it). It shows a card with ready-to-use guest login credentials and a button to open the platform, where a built-in guided walkthrough explains every screen. Prefer this over request_demo when the user wants to explore the product themselves right now. Do not ask for their email — the guest login is shared and pre-made.",
    parameters: z.object({
      reason: z
        .string()
        .optional()
        .describe('Brief note on why the tour is being offered now (for analytics).'),
    }),
    execute: async ({ reason }) => {
      try {
        await emit('tool_call', { tool: 'offer_guest_tour', reason: reason ?? null }, sessionId);
      } catch {
        // telemetry is best-effort
      }
      return { ok: true };
    },
  });
}
