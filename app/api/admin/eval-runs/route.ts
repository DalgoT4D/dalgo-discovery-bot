import { NextResponse, after } from 'next/server';
import { auth } from '@/lib/auth';
import { startFullRun, drainEvalRuns } from '@/lib/llm/eval/run-service';
import { listEvalRuns } from '@/lib/db/queries/eval-runs';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(_req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = await startFullRun(session.user.email ?? 'admin');
  // Kick the first chunk immediately so the run starts now rather than waiting for
  // the next eval-drain cron tick. after() runs post-response, within maxDuration;
  // the cron picks up any remaining chunks. Claim locking makes the overlap safe.
  after(async () => {
    try {
      await drainEvalRuns();
    } catch (e) {
      console.error('[eval-runs] initial drain kick failed:', e);
    }
  });
  return NextResponse.json({ id }, { status: 202 });
}

export async function GET(_req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const runs = await listEvalRuns({ limit: 50 });
  return NextResponse.json({ runs });
}
