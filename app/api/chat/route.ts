import { NextRequest } from 'next/server';
import { streamText, type CoreMessage } from 'ai';
import { anthropic, MODEL } from '@/lib/llm/client';
import { buildSystemPrompt } from '@/lib/llm/system-prompt';
import { getSession } from '@/lib/db/queries/sessions';
import { listMessages, appendMessage } from '@/lib/db/queries/messages';
import { buildToolset } from '@/lib/llm/tools';

export async function POST(req: NextRequest) {
  const { session_id, message } = (await req.json()) as {
    session_id: string;
    message: string;
  };

  const session = await getSession(session_id);
  const history = await listMessages(session_id);

  await appendMessage(session_id, 'user', { text: message });

  const messages: CoreMessage[] = history
    .map((m) => {
      const text =
        typeof m.content === 'string'
          ? m.content
          : ((m.content as { text?: string } | null)?.text ?? '');
      return {
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: text,
      } satisfies CoreMessage;
    })
    .concat({ role: 'user', content: message });

  const result = streamText({
    model: anthropic(MODEL),
    system: buildSystemPrompt({
      ngo_summary: session.ngo_summary,
      ngo_systems: session.ngo_systems,
      data_types: session.data_types,
    }),
    messages,
    tools: buildToolset(session_id),
    maxSteps: 6,
    onFinish: async ({ text, usage }) => {
      await appendMessage(session_id, 'assistant', { text }, usage?.completionTokens);
    },
  });

  return result.toDataStreamResponse();
}
