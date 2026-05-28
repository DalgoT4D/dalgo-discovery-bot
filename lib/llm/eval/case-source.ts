import { listEvalCases, type EvalCaseRow } from '@/lib/db/queries/eval-cases';
import type { EvalCase } from './cases/types';

const TTL_MS = 60_000;

interface CacheEntry {
  cases: EvalCase[];
  expires: number;
}

const cache = new Map<string, CacheEntry>();
let hits = 0;
let misses = 0;

const ALL_KEY = '__all__';

function rowToCase(row: EvalCaseRow): EvalCase {
  return {
    id: row.case_key,
    bucket: row.bucket as EvalCase['bucket'],
    input: row.input,
    expected: row.expected as EvalCase['expected'],
    judge: row.judges as EvalCase['judge'],
  };
}

export async function getEvalCases(bucket?: string): Promise<EvalCase[]> {
  const key = bucket ?? ALL_KEY;
  const entry = cache.get(key);
  const now = Date.now();
  if (entry && entry.expires > now) {
    hits++;
    return entry.cases;
  }
  misses++;
  const rows = await listEvalCases({ bucket, enabledOnly: true });
  const cases = rows.map(rowToCase);
  cache.set(key, { cases, expires: now + TTL_MS });
  return cases;
}

export function invalidateEvalCaseCache(bucket?: string): void {
  if (bucket) {
    cache.delete(bucket);
    cache.delete(ALL_KEY); // any change can affect the "all" view
  } else {
    cache.clear();
  }
}

// ─── test-only exports ──────────────────────────────────────────────────────
export function __resetForTests(): void {
  cache.clear();
  hits = 0;
  misses = 0;
}

export function __cacheStatsForTests(): { hits: number; misses: number; size: number } {
  return { hits, misses, size: cache.size };
}
