import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { rows } = await query(
    `SELECT
        s.id                                   AS session_id,
        s.created_at,
        s.email,
        s.work_domain,
        s.ngo_url,
        s.wants_followup,
        s.triage_status,
        COALESCE(bool_or(l.intent = 'demo'), false) AS requested_demo
     FROM sessions s
     LEFT JOIN leads l ON l.session_id = s.id
     WHERE s.email IS NOT NULL AND s.is_admin = false
     GROUP BY s.id
     ORDER BY s.created_at DESC`,
  );
  return NextResponse.json({ items: rows });
}
