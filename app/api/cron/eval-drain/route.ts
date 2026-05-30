import { NextRequest, NextResponse } from 'next/server';
import { drainEvalRuns } from '@/lib/llm/eval/run-service';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Drains the eval-run queue one time-bounded chunk per invocation.
 *
 * Scheduled every minute in vercel.json. Each tick claims the next due 'full'
 * run and processes cases until ~3.5 min elapsed, checkpointing progress to the
 * row; the next tick resumes from there. Idle ticks (no pending run) are a single
 * cheap query. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const result = await drainEvalRuns();
  return NextResponse.json({ ok: true, ...result });
}
