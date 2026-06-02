/**
 * Next.js instrumentation hook — runs once when the server process starts.
 * We use it to register in-process scheduled maintenance (node-cron) so the
 * app container is self-contained: no host crontab or external scheduler
 * needed for routine cleanup. Works identically in local Docker and on EC2.
 */
export async function register() {
  // Only run in the Node.js server runtime (not Edge), and skip during
  // `next build`. The cron daemon is a long-running side effect we only want
  // in an actual serving process.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.DISABLE_CRON === 'true') return;

  const cron = await import('node-cron');
  const { cleanupRateLimitBuckets } = await import('@/lib/maintenance');

  // Daily at 04:00 UTC — prune stale rate-limit rows.
  cron.schedule(
    '0 4 * * *',
    async () => {
      try {
        const deleted = await cleanupRateLimitBuckets();
        console.log(`[cron] rate-limit-cleanup: deleted ${deleted} stale row(s)`);
      } catch (err) {
        console.error('[cron] rate-limit-cleanup failed:', err);
      }
    },
    { timezone: 'UTC', name: 'rate-limit-cleanup' },
  );

  console.log('[cron] scheduled: rate-limit-cleanup (daily 04:00 UTC)');
}
