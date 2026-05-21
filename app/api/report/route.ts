import { NextRequest, NextResponse } from 'next/server';
import { renderReportPdf } from '@/lib/pdf-report';
import { listMessages } from '@/lib/db/queries/messages';
import { getSession } from '@/lib/db/queries/sessions';
import { generateText } from 'ai';
import { anthropic, MODEL } from '@/lib/llm/client';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const session_id = req.nextUrl.searchParams.get('session_id');
  if (!session_id)
    return NextResponse.json({ error: 'missing session_id' }, { status: 400 });
  let session;
  try {
    session = await getSession(session_id);
  } catch {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  const msgs = await listMessages(session_id);
  const convo = msgs
    .map((m) => {
      const content = m.content as { text?: string } | string | null;
      const text =
        typeof content === 'string' ? content : (content?.text ?? '');
      return `${m.role}: ${text}`;
    })
    .join('\n');

  const { text } = await generateText({
    model: anthropic(MODEL),
    system:
      'You produce a structured summary of a discovery chat between an NGO and a Dalgo assistant. Output strict JSON with keys: summary (string), key_findings (string[]), recommendations (string[]). Use only facts mentioned in the chat. No prose outside the JSON.',
    messages: [{ role: 'user', content: convo.slice(-12000) }],
  });

  let parsed: { summary?: string; key_findings?: string[]; recommendations?: string[] };
  try {
    // Sometimes LLMs wrap JSON in code fences; strip them.
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: 'Failed to summarize. Try again.' }, { status: 500 });
  }

  const pdf = await renderReportPdf({
    ngoName: session.ngo_url ?? 'your NGO',
    summary: parsed.summary ?? '',
    keyFindings: parsed.key_findings ?? [],
    recommendations: parsed.recommendations ?? [],
  });

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="dalgo-discovery-${session_id}.pdf"`,
    },
  });
}
