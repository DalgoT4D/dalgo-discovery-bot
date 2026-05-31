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
  // Kick the drain immediately so the run starts now rather than waiting for the
  // next eval-drain cron tick. after() runs post-response, within maxDuration.
  //
  // On Vercel: do ONE chunk here, then let the per-minute cron drain the rest
  // (the function is torn down after this anyway). On local dev there IS no cron,
  // so keep draining in-process until the queue is empty — otherwise the run would
  // stall after the first chunk and the progress bar would freeze. Claim locking
  // makes any overlap with the cron safe.
  after(async () => {
    try {
      for (;;) {
        const r = await drainEvalRuns();
        if (process.env.VERCEL || !r.claimed) break;
      }
    } catch (e) {
      console.error('[eval-runs] drain kick failed:', e);
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
