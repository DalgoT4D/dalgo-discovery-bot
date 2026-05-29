import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const { rows } = await query<{ retrieval_trace: any }>(
    'SELECT retrieval_trace FROM messages WHERE id = $1',
    [id],
  );
  if (rows.length === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ trace: rows[0].retrieval_trace });
}
