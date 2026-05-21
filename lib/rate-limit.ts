import { query } from './db/client';

const WINDOW_MS = 60 * 60 * 1000;
const MAX = parseInt(process.env.RATE_LIMIT_MAX_MSG_PER_HOUR ?? '60', 10);

export async function checkRateLimit(ip: string): Promise<{ ok: boolean; remaining: number }> {
  if (!ip) return { ok: true, remaining: MAX };
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS);

  const { rows } = await query<{ window_start: string; count: number }>(
    'SELECT window_start, count FROM rate_limit_buckets WHERE ip = $1',
    [ip],
  );

  if (!rows[0] || new Date(rows[0].window_start) < windowStart) {
    await query(
      `INSERT INTO rate_limit_buckets (ip, window_start, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (ip) DO UPDATE SET window_start = EXCLUDED.window_start, count = 1`,
      [ip, now.toISOString()],
    );
    return { ok: true, remaining: MAX - 1 };
  }

  if (rows[0].count >= MAX) return { ok: false, remaining: 0 };
  await query(
    'UPDATE rate_limit_buckets SET count = count + 1 WHERE ip = $1',
    [ip],
  );
  return { ok: true, remaining: MAX - (rows[0].count + 1) };
}
