import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listKbVersions } from '@/lib/db/queries/kb-versions';

interface Ctx { params: Promise<{ id: string }>; }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const versions = await listKbVersions(id);
  return NextResponse.json({ versions });
}
