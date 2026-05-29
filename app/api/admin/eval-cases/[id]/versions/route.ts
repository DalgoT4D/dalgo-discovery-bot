import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listEvalCaseVersions, getEvalCase } from '@/lib/db/queries/eval-cases';

interface RouteContext { params: Promise<{ id: string }>; }

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await getEvalCase(id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const versions = await listEvalCaseVersions(id);
  return NextResponse.json({ versions });
}
