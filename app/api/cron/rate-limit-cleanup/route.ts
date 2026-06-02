import { NextRequest, NextResponse } from 'next/server';
import { cleanupRateLimitBuckets } from '@/lib/maintenance';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Manual / external trigger for the rate_limit_buckets cleanup. The same job
 * also runs automatically in-process via the node-cron scheduler in
 * instrumentation.ts — this endpoint is kept for on-demand runs and platforms
 * that prefer an external scheduler (Vercel cron, AWS EventBridge, etc.).
 */
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const deleted = await cleanupRateLimitBuckets();
  return NextResponse.json({ ok: true, deleted });
}
