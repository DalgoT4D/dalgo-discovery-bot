import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLead } from '@/lib/db/queries/leads';
import { getSession } from '@/lib/db/queries/sessions';
import { postHotLead } from '@/lib/slack';

const Body = z.object({
  session_id: z.string().uuid(),
  email: z.string().email(),
  intent: z.enum(['demo', 'pdf_report', 'flag_questions']),
  summary: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = Body.parse(await req.json());
  let session;
  try {
    session = await getSession(body.session_id);
  } catch {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }
  const lead = await createLead(body.session_id, body.email, body.intent, body.summary);
  if (body.intent === 'demo') {
    await postHotLead({
      email: body.email,
      ngo_url: session.ngo_url ?? undefined,
      summary: body.summary,
      session_id: body.session_id,
    });
  }
  return NextResponse.json({ lead_id: lead.id });
}
