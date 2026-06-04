import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db/client';
import { insertLead } from '@/lib/db/queries/leads';
import { emit } from '@/lib/telemetry';
import { WORK_DOMAIN_VALUES } from '@/lib/work-domains';

const IntakeBody = z.object({
  email: z.string().email(),
  work_domain: z.enum(WORK_DOMAIN_VALUES as [string, ...string[]]).optional(),
  // Optional org context captured at intake. org_url maps to sessions.ngo_url.
  org_name: z.string().trim().max(200).optional(),
  org_url: z.string().trim().max(500).optional(),
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
  const workDomain = parsed.data.work_domain ?? null;
  const orgName = parsed.data.org_name || null;
  const orgUrl = parsed.data.org_url || null;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  // Email-keyed resume: if a session already exists for this email, return it
  // without creating a new session or lead row. Backfill optional fields only
  // when a value was provided and none is stored yet (don't overwrite with null).
  const existing = await query<{ id: string }>(
    `SELECT id FROM sessions WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
    [email],
  );
  if (existing.rows[0]) {
    await query(
      `UPDATE sessions
          SET work_domain = COALESCE(work_domain, $2),
              ngo_name    = COALESCE(ngo_name, $3),
              ngo_url     = COALESCE(ngo_url, $4)
        WHERE id = $1`,
      [existing.rows[0].id, workDomain, orgName, orgUrl],
    );
    return NextResponse.json({ session_id: existing.rows[0].id, resumed: true });
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO sessions (ip, email, work_domain, ngo_name, ngo_url)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [ip, email, workDomain, orgName, orgUrl],
  );
  const sessionId = rows[0].id;

  await insertLead({ sessionId, email, intent: 'email_signup' });
  await emit('session_started', { has_pdf: false }, sessionId);
  await emit('lead_captured', { intent: 'email_signup', source_cta: 'email_gate' }, sessionId);

  return NextResponse.json({ session_id: sessionId, resumed: false });
}
