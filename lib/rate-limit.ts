import { query } from './db/client';

// Per-IP message cap. Defaults: 40 messages per 30-minute fixed window.
// Both tunable via env so we can dial throttling without a code change.
const MAX = parseInt(process.env.RATE_LIMIT_MAX_MSG ?? '40', 10);
const WINDOW_MIN = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES ?? '30', 10);

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the current window resets (only meaningful when !ok). */
  retryAfterSec: number;
}

/**
 * Atomic per-IP rate limit over a fixed window.
 *
 * The whole check-and-increment is a single SQL statement so concurrent
 * requests from the same IP can't both read a stale count and slip past the
 * cap (the race the previous read-then-write version had). Postgres `now()`
 * is the time source, so all instances agree without clock-skew worries.
 *
 * Behaviour:
 *  - First request for an IP (or first after the window expires) starts a
 *    fresh window with count = 1.
 *  - Subsequent requests within the window increment the count. We increment
 *    even on over-limit requests — that's harmless (still rejected) and keeps
 *    the statement branch-free; the window resets on time regardless.
 *  - window_start is NOT extended on hits, so the window is a true fixed
 *    window measured from the first request.
 */
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  if (!ip) return { ok: true, remaining: MAX, retryAfterSec: 0 };

  const { rows } = await query<{ count: number; reset_at: string }>(
    `INSERT INTO rate_limit_buckets (ip, window_start, count)
     VALUES ($1, now(), 1)
     ON CONFLICT (ip) DO UPDATE SET
       count = CASE
         WHEN rate_limit_buckets.window_start < now() - ($2 || ' minutes')::interval
         THEN 1
         ELSE rate_limit_buckets.count + 1
       END,
       window_start = CASE
         WHEN rate_limit_buckets.window_start < now() - ($2 || ' minutes')::interval
         THEN now()
         ELSE rate_limit_buckets.window_start
       END
     RETURNING count,
       (window_start + ($2 || ' minutes')::interval) AS reset_at`,
    [ip, String(WINDOW_MIN)],
  );

  const count = rows[0].count;
  const resetAt = new Date(rows[0].reset_at).getTime();
  const retryAfterSec = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));

  if (count > MAX) {
    return { ok: false, remaining: 0, retryAfterSec };
  }
  return { ok: true, remaining: Math.max(0, MAX - count), retryAfterSec: 0 };
}
