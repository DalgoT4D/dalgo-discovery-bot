import { query } from './db/client';

// Consecutive low-value turns before an IP is soft-blocked, and how long the
// block lasts. Both tunable via env. A genuine on-topic message resets the
// strike count to zero, so these only fire on *sustained* junk.
const STRIKE_THRESHOLD = parseInt(process.env.ABUSE_STRIKE_THRESHOLD ?? '5', 10);
const BLOCK_MINUTES = parseInt(process.env.ABUSE_BLOCK_MINUTES ?? '30', 10);

// Hard cap on a single message. Guards against token-bomb inputs. Generous
// enough for a paragraph-long NGO description (~800 words).
const MAX_MESSAGE_CHARS = parseInt(process.env.MAX_MESSAGE_CHARS ?? '4000', 10);

// Unicode letter-or-number. NOTE: must be Unicode-aware (\p{L}/\p{N}, not
// [a-z0-9]) so messages in Hindi/Devanagari or other non-Latin scripts from
// genuine NGO users are NOT mistaken for gibberish.
const HAS_REAL_CONTENT = /[\p{L}\p{N}]/u;

export type MessageVerdict = 'ok' | 'junk' | 'too_long';

/**
 * Cheap, free pre-filter run before any LLM call.
 *  - 'too_long' → reject with guidance, but NOT a strike (could be a sincere
 *    long paste; we don't want to punish verbosity).
 *  - 'junk' → empty, symbol/emoji-only, or an exact repeat of the previous
 *    user message → counts as a strike.
 *  - 'ok' → goes to the model, which may still flag it semantically.
 */
export function classifyMessage(message: string, lastUserMessage?: string | null): MessageVerdict {
  const trimmed = message.trim();
  if (trimmed.length === 0) return 'junk';
  if (message.length > MAX_MESSAGE_CHARS) return 'too_long';
  if (!HAS_REAL_CONTENT.test(trimmed)) return 'junk';
  if (lastUserMessage && trimmed === lastUserMessage.trim()) return 'junk';
  return 'ok';
}

export interface BlockState {
  blocked: boolean;
  retryAfterSec: number;
}

function retryAfter(blockedUntil: string | null): number {
  if (!blockedUntil) return 0;
  return Math.max(0, Math.ceil((new Date(blockedUntil).getTime() - Date.now()) / 1000));
}

/** Is this IP currently blocked? Read-only, no side effects. */
export async function getBlockState(ip: string): Promise<BlockState> {
  if (!ip) return { blocked: false, retryAfterSec: 0 };
  const { rows } = await query<{ blocked_until: string }>(
    `SELECT blocked_until FROM rate_limit_buckets
      WHERE ip = $1 AND blocked_until IS NOT NULL AND blocked_until > now()`,
    [ip],
  );
  if (!rows[0]) return { blocked: false, retryAfterSec: 0 };
  return { blocked: true, retryAfterSec: retryAfter(rows[0].blocked_until) };
}

/**
 * Record one strike for an IP. Atomic. When the (post-increment) strike count
 * reaches the threshold, set blocked_until = now + BLOCK_MINUTES and reset the
 * strike counter so the block is a clean one-shot. The IP row already exists
 * (checkRateLimit upserts it earlier in the request), but we upsert defensively.
 */
export async function recordStrike(ip: string): Promise<BlockState> {
  if (!ip) return { blocked: false, retryAfterSec: 0 };
  const { rows } = await query<{ blocked_until: string | null }>(
    `INSERT INTO rate_limit_buckets (ip, window_start, count, strikes)
     VALUES ($1, now(), 0, 1)
     ON CONFLICT (ip) DO UPDATE SET
       strikes = CASE
         WHEN rate_limit_buckets.strikes + 1 >= $2 THEN 0
         ELSE rate_limit_buckets.strikes + 1
       END,
       blocked_until = CASE
         WHEN rate_limit_buckets.strikes + 1 >= $2
         THEN now() + ($3 || ' minutes')::interval
         ELSE rate_limit_buckets.blocked_until
       END
     RETURNING blocked_until`,
    [ip, String(STRIKE_THRESHOLD), String(BLOCK_MINUTES)],
  );
  const blockedUntil = rows[0]?.blocked_until ?? null;
  const blocked = Boolean(blockedUntil && new Date(blockedUntil).getTime() > Date.now());
  return { blocked, retryAfterSec: blocked ? retryAfter(blockedUntil) : 0 };
}

/** A genuine on-topic turn — clear the consecutive-strike counter. */
export async function clearStrikes(ip: string): Promise<void> {
  if (!ip) return;
  await query(`UPDATE rate_limit_buckets SET strikes = 0 WHERE ip = $1 AND strikes <> 0`, [ip]);
}
