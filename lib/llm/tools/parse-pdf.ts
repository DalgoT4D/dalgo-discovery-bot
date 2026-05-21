import { tool } from 'ai';
import { z } from 'zod';
import { getSession } from '@/lib/db/queries/sessions';

export function parsePdfTool(sessionId: string) {
  return tool({
    description: 'Read text from the PDF the user uploaded at the start of this session.',
    parameters: z.object({}),
    execute: async () => {
      const session = await getSession(sessionId);
      if (!session.pdf_text) return { error: 'No PDF was uploaded.' };
      return { text: session.pdf_text };
    },
  });
}
