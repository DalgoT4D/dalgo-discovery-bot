import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { rows } = await query(
    `SELECT l.id, l.created_at, l.email, l.intent, l.session_id, s.ngo_url
     FROM leads l LEFT JOIN sessions s ON s.id = l.session_id
     ORDER BY l.created_at DESC`,
  );
  return NextResponse.json({ items: rows });
}
