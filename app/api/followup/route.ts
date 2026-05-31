import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, setWantsFollowup } from '@/lib/db/queries/sessions';
import { postHotLead } from '@/lib/slack';
import { emit } from '@/lib/telemetry';

const Body = z.object({ session_id: z.string().uuid() });

export async function PATCH(req: NextRequest | Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const { session_id } = parsed.data;

  let session;
  try {
    session = await getSession(session_id);
  } catch {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  await setWantsFollowup(session_id);
  await emit('lead_captured', { intent: 'followup', source_cta: 'followup_optin' }, session_id);

  // Non-fatal: a Slack failure must not break the user's opt-in.
  try {
    if (session.email) {
      await postHotLead({
        email: session.email,
        ngo_url: session.ngo_url ?? undefined,
        session_id,
      });
    }
  } catch {
    // swallow — telemetry already recorded the opt-in
  }

  return NextResponse.json({ ok: true });
}
