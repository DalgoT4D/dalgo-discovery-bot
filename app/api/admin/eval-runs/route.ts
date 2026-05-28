import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { startFullRun } from '@/lib/llm/eval/run-service';
import { listEvalRuns } from '@/lib/db/queries/eval-runs';

export async function POST(_req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = await startFullRun(session.user.email ?? 'admin');
  return NextResponse.json({ id }, { status: 202 });
}

export async function GET(_req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const runs = await listEvalRuns({ limit: 50 });
  return NextResponse.json({ runs });
}
