import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getEvalRun, getEvalRunResults } from '@/lib/db/queries/eval-runs';

interface Ctx { params: Promise<{ id: string }>; }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const run = await getEvalRun(id);
  if (!run) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const results = await getEvalRunResults(id);
  return NextResponse.json({ run, results });
}
