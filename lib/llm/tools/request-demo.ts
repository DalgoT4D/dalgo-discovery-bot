import { tool } from 'ai';
import { z } from 'zod';
import { createLead } from '@/lib/db/queries/leads';
import { getSession } from '@/lib/db/queries/sessions';
import { postHotLead } from '@/lib/slack';

export function requestDemoTool(sessionId: string) {
  return tool({
    description:
      "Capture an NGO's interest in a demo or follow-up. Call this only after the user explicitly agrees and provides an email.",
    parameters: z.object({
      email: z.string().email(),
      summary: z.string().optional(),
    }),
    execute: async ({ email, summary }) => {
      const session = await getSession(sessionId);
      const lead = await createLead(sessionId, email, 'demo', summary);
      await postHotLead({
        email,
        ngo_url: session.ngo_url ?? undefined,
        summary,
        session_id: sessionId,
      });
      return { ok: true, lead_id: lead.id };
    },
  });
}
