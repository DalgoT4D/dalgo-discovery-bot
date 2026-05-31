import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';

const Body = z.object({
  triage_status: z.enum(['new', 'approved', 'rejected']),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { sessionId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const { rowCount } = await query(
    `UPDATE sessions SET triage_status = $2 WHERE id = $1`,
    [sessionId, parsed.data.triage_status],
  );
  if (!rowCount) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
