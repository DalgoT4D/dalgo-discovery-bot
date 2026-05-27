import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db/client';
import { insertLead } from '@/lib/db/queries/leads';
import { emit } from '@/lib/telemetry';

const IntakeBody = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = IntakeBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const email = parsed.data.email.toLowerCase().trim();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  // Email-keyed resume: if a session already exists for this email, return it
  // without creating a new session or lead row.
  const existing = await query<{ id: string }>(
    `SELECT id FROM sessions WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
    [email],
  );
  if (existing.rows[0]) {
    return NextResponse.json({ session_id: existing.rows[0].id, resumed: true });
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO sessions (ip, email) VALUES ($1, $2) RETURNING id`,
    [ip, email],
  );
  const sessionId = rows[0].id;

  await insertLead({ sessionId, email, intent: 'email_signup' });
  await emit('session_started', { has_pdf: false }, sessionId);
  await emit('lead_captured', { intent: 'email_signup', source_cta: 'email_gate' }, sessionId);

  return NextResponse.json({ session_id: sessionId, resumed: false });
}
