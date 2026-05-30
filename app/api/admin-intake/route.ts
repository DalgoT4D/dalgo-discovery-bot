import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';
import { findAdminByEmail } from '@/lib/db/queries/admins';
import { insertLead } from '@/lib/db/queries/leads';
import { emit } from '@/lib/telemetry';

export async function POST(req: NextRequest) {
  const session = await auth();
  const rawEmail = session?.user?.email;
  if (!rawEmail) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const email = rawEmail.toLowerCase().trim();

  // Defense in depth: a signed JWT cookie is not enough — the admin row
  // must still exist in the DB. Catches the stale-cookie case where the
  // admin account was deleted (or password rotated) after sign-in.
  const adminRow = await findAdminByEmail(email);
  if (!adminRow) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  // Email-keyed resume: if a session already exists for this admin email, return it
  // without creating a new session or lead row. Matches /api/intake behavior.
  const existing = await query<{ id: string }>(
    `SELECT id FROM sessions WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
    [email],
  );
  if (existing.rows[0]) {
    return NextResponse.json({ session_id: existing.rows[0].id, resumed: true });
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO sessions (ip, email, is_admin) VALUES ($1, $2, true) RETURNING id`,
    [ip, email],
  );
  const sessionId = rows[0].id;

  await insertLead({ sessionId, email, intent: 'email_signup' });
  await emit('session_started', { has_pdf: false }, sessionId);
  await emit('lead_captured', { intent: 'email_signup', source_cta: 'email_gate' }, sessionId);

  return NextResponse.json({ session_id: sessionId, resumed: false });
}
