import { tool } from 'ai';
import { z } from 'zod';
import { fetchAndSummarizeNgoWebsite } from '@/lib/tavily';
import { updateSession } from '@/lib/db/queries/sessions';

export function fetchNgoWebsiteTool(sessionId: string) {
  return tool({
    description:
      "Fetch and summarize the public NGO website. Use this when the user mentions their organization's URL but we don't yet have a summary.",
    parameters: z.object({
      url: z.string().url(),
      max_pages: z.number().int().min(1).max(10).optional(),
    }),
    execute: async ({ url, max_pages }) => {
      const summary = await fetchAndSummarizeNgoWebsite(url, max_pages ?? 5);
      if (summary) await updateSession(sessionId, { ngo_summary: summary });
      return summary
        ? { summary }
        : { error: 'Could not fetch the website. Ask the user to describe their NGO instead.' };
    },
  });
}
