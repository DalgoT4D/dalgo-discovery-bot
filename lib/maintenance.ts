import { query } from './db/client';

/**
 * Prune stale rate_limit_buckets rows so the table doesn't grow by one row per
 * unique visitor IP forever. A row is safe to drop once its rate-limit window
 * has lapsed (>1 day) AND it isn't actively blocked — the next request from
 * that IP simply re-creates a fresh row. Active blocks are preserved.
 *
 * Shared by the in-process scheduler (instrumentation.ts) and the manual HTTP
 * trigger (app/api/cron/rate-limit-cleanup). Returns the number of rows deleted.
 */
export async function cleanupRateLimitBuckets(): Promise<number> {
  const { rowCount } = await query(
    `DELETE FROM rate_limit_buckets
      WHERE window_start < now() - interval '1 day'
        AND (blocked_until IS NULL OR blocked_until < now())`,
  );
  return rowCount;
}
