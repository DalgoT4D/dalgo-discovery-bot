import { query } from '@/lib/db/client';

const TTL_MS = 60_000;

type CacheEntry = { content: string; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
let version = 0;

// Cache-miss stampede note: concurrent calls for the same key on a cold
// cache may each issue a SELECT and overwrite each other's entry. This is
// safe (idempotent writes, same DB row) and acceptable at the expected
// admin/chat request rate, so we don't promise-coalesce.
export async function getPrompt(key: string): Promise<string> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) {
    return hit.content;
  }
  const { rows } = await query<{ content: string }>(
    `SELECT content FROM dalgo_prompts WHERE key = $1`,
    [key],
  );
  if (!rows[0]) {
    throw new Error(`Prompt key '${key}' not found in dalgo_prompts`);
  }
  const fetchedAt = Date.now();
  cache.set(key, { content: rows[0].content, fetchedAt });
  return rows[0].content;
}

export function invalidatePromptCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
  version++;
}

// ─── test-only exports ──────────────────────────────────────────────────────
export function __resetForTests(): void {
  cache.clear();
  version = 0;
}

export function __cacheStatsForTests(): {
  size: number;
  version: number;
  entries: Record<string, number>; // key -> fetchedAt
} {
  return {
    size: cache.size,
    version,
    entries: Object.fromEntries(
      [...cache.entries()].map(([k, v]) => [k, v.fetchedAt]),
    ),
  };
}
