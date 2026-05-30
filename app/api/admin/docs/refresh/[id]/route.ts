import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  const { rows } = await query(
    `SELECT id, status, pages_seen, pages_new, pages_updated, pages_skipped,
            started_at, finished_at, error, created_at
       FROM doc_refresh_jobs WHERE id = $1`,
    [id],
  );
  if (!rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ job: rows[0] });
}
