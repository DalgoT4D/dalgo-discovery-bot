import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { cancelEvalRun } from '@/lib/db/queries/eval-runs';

interface Ctx { params: Promise<{ id: string }>; }

export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const cancelled = await cancelEvalRun(id);
  // `cancelled: false` just means it was already terminal — not an error.
  return NextResponse.json({ ok: true, cancelled });
}
