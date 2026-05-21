import { NextRequest, NextResponse } from 'next/server';
import { streamText, type CoreMessage } from 'ai';
import { anthropic, MODEL } from '@/lib/llm/client';
import { staticSystem, ngoContextBlock } from '@/lib/llm/system-prompt';
import { getSession } from '@/lib/db/queries/sessions';
import { listMessages, appendMessage } from '@/lib/db/queries/messages';
import { buildToolset } from '@/lib/llm/tools';
import { checkRateLimit } from '@/lib/rate-limit';
import { emit } from '@/lib/telemetry';

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

  const summary = session.ngo_summary
    ? `I took a look at your organization.`
    : 'your organization';
  const systems = session.ngo_systems ? ` Since you mentioned ${session.ngo_systems},` : '';
  const greeting = `Hi! ${summary}${systems} here are 3 questions other NGOs in your space often ask. Or feel free to ask anything else.`;

  return NextResponse.json({
    greeting,
    starters: [
      'Can Dalgo connect to KoboToolbox?',
      'How would Dalgo handle our M&E reporting?',
      'What does setup look like for a small team?',
    ],
    ready: true,
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

  const systemMessages: CoreMessage[] = [
    {
      role: 'system',
      content: staticSystem(),
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    ...(ngoBlock ? [{ role: 'system' as const, content: ngoBlock }] : []),
  ];

  const result = streamText({
    model: anthropic(MODEL),
    messages: [...systemMessages, ...messages],
    tools: buildToolset(session_id),
    maxSteps: 6,
    onFinish: async ({ text, usage }) => {
      await appendMessage(session_id, 'assistant', { text }, usage?.completionTokens);
      await emit(
        'message_sent',
        { role: 'assistant', tokens: usage?.completionTokens ?? null },
        session_id,
      );
    },
  });

  return result.toDataStreamResponse();
}
