import { NextRequest, NextResponse } from 'next/server';
import { streamText, type CoreMessage } from 'ai';
import { anthropic, MODEL } from '@/lib/llm/client';
import { staticSystem, ngoContextBlock } from '@/lib/llm/system-prompt';
import { getSession } from '@/lib/db/queries/sessions';
import { listMessages, appendMessage } from '@/lib/db/queries/messages';
import { query } from '@/lib/db/client';
import { buildToolset } from '@/lib/llm/tools';
import { checkRateLimit } from '@/lib/rate-limit';
import { emit } from '@/lib/telemetry';
import { getOrCreateIntro } from '@/lib/llm/intro-generator';
import { runPipeline, type RetrievalTrace } from '@/lib/llm/rag/pipeline';

export async function GET(req: NextRequest) {
  const session_id = req.nextUrl.searchParams.get('session_id');
  if (!session_id) {
    return NextResponse.json({ error: 'missing session_id' }, { status: 400 });
  }
  let session;
  try {
    session = await getSession(session_id);
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const intro = await getOrCreateIntro(session_id);

  // Hydrate prior conversation so a returning user sees their history,
  // not the empty-state intro cards. Filter to user/assistant only
  // (tool messages are internal RAG plumbing, not user-visible) and
  // pull out the .text payload from the jsonb content column.
  const history = await listMessages(session_id);
  const initial_messages = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: (m.content as { text?: string } | null)?.text ?? '',
    }))
    .filter((m) => m.content.length > 0);

  // Build a greeting that introduces the bot, says what Dalgo is in one line,
  // sets the plain-language expectation, then surfaces what we learned about
  // the NGO so the user can see the URL/PDF/intake context wasn't wasted.
  const parts: string[] = [
    "Hi! I'm the **Dalgo Fit Bot** — here to help you figure out whether Dalgo is a good fit for your NGO.",
    'In one line: **Dalgo is a data platform built for NGOs** that brings your data together from different tools, cleans it up, and turns it into dashboards and reports.',
    "_I'll explain things in plain, non-technical language so Dalgo is easy to understand. Want more technical (or even simpler) detail? Just ask for it in your question._",
  ];
  if (intro.learned) {
    parts.push(`**Here's what I picked up about you:** ${intro.learned}`);
  } else if (session.ngo_systems) {
    parts.push(`You mentioned you use **${session.ngo_systems}** today.`);
  }
  parts.push('Pick one of the suggestions below to get started — or just type your question.');
  const greeting = parts.join('\n\n');

  return NextResponse.json({
    greeting,
    starters: intro.starters,
    ready: true,
    is_admin: Boolean(session.is_admin),
    email: session.email ?? null,
    initial_messages,
  });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const rl = await checkRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429 },
    );
  }

  const { session_id, message } = (await req.json()) as {
    session_id: string;
    message: string;
  };

  const session = await getSession(session_id);
  const history = await listMessages(session_id);

  await appendMessage(session_id, 'user', { text: message });
  await emit('message_sent', { role: 'user', text_len: message.length }, session_id);

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

  // Two-part system: cached static + dynamic NGO context.
  // NOTE: AI SDK v4 supports providerOptions on individual message parts;
  // when applied at the system-message level via the messages array we
  // include cacheControl for Anthropic prompt caching.
  const ngoBlock = ngoContextBlock({
    ngo_summary: session.ngo_summary,
    ngo_systems: session.ngo_systems,
    data_types: session.data_types,
  });

  // Pre-retrieve via the RAG pipeline before streaming, so the model has
  // top passages in context from the first token. If retrieval fails for any
  // reason, fall back to the un-augmented prompt — tools remain available.
  let prePassages: string[] = [];
  let trace: RetrievalTrace | null = null;
  if (typeof message === 'string' && message.length > 5) {
    try {
      const pipelineResult = await runPipeline(message);
      prePassages = pipelineResult.topPassages.map((p) => p.text);
      trace = pipelineResult.trace;
    } catch (e) {
      console.error('[chat] pipeline failed:', e);
    }
  }
  const retrievalBlock =
    prePassages.length > 0
      ? `## Retrieved context for this turn\n${prePassages.join('\n\n---\n\n')}\n\nUse the above as primary evidence. Tools remain available if you need additional lookup.`
      : null;

  const systemMessages: CoreMessage[] = [
    {
      role: 'system',
      content: await staticSystem(),
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    ...(ngoBlock ? [{ role: 'system' as const, content: ngoBlock }] : []),
    ...(retrievalBlock ? [{ role: 'system' as const, content: retrievalBlock }] : []),
  ];

  const result = streamText({
    model: anthropic(MODEL),
    messages: [...systemMessages, ...messages],
    tools: buildToolset(session_id),
    maxSteps: 6,
    onFinish: async ({ text, usage }) => {
      const assistantRow = await appendMessage(
        session_id,
        'assistant',
        { text },
        usage?.completionTokens,
      );
      if (trace) {
        await query(
          `UPDATE messages
              SET retrieval_trace = $1::jsonb
            WHERE id = $2`,
          [JSON.stringify(trace), assistantRow.id],
        );
      }
      await emit(
        'message_sent',
        { role: 'assistant', tokens: usage?.completionTokens ?? null },
        session_id,
      );
    },
  });

  return result.toDataStreamResponse();
}
