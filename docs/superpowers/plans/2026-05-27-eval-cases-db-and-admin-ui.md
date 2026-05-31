# Eval cases DB + admin UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move eval cases out of `lib/llm/eval/cases/*.ts` and into a `dalgo_eval_cases` Postgres table with full admin CRUD UI at `/admin/evals`, mirroring the existing `dalgo_prompts` pattern (DB-backed, 60s in-memory cache, version history, bust-on-write).

**Architecture:** Two new tables — `dalgo_eval_cases` (current state) + `dalgo_eval_case_versions` (history). A `getEvalCases()` reader in `lib/llm/eval/case-source.ts` with 60s TTL cache. A one-shot seed script imports current TS-file cases into the DB so nothing regresses. The eval runner (`lib/llm/eval/runner.ts`) is updated to pull cases from `getEvalCases()` instead of `import { CASES } from './cases/...'`. Admin UI is three new pages (`/admin/evals`, `/admin/evals/new`, `/admin/evals/[id]`) reusing the same form patterns as the existing prompts admin.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest (`environment: node`), raw `pg` Pool, NextAuth v5, Tailwind v4. Migration tooling: `psql` against the local `dalgo-discovery-db` container.

**Spec:** This plan is the spec (small enough not to warrant a separate design doc).

**Branch:** `feat/blog-ingestion` (continue commits; do NOT merge to main or push without explicit user instruction).

**Pre-flight expectations:**
- Postgres container `dalgo-discovery-db` is up (`docker compose up -d` if not). Apply migrations via `docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery < <file>`.
- `.env.local` has `DATABASE_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, NextAuth credentials. Tests load `.env.local` via `DOTENV_CONFIG_PATH`.
- Single test file: `npm test -- tests/lib/db/eval-cases.test.ts`
- All tests: `npm test`
- Tests connect to live local Postgres. Every test file ends with `afterAll(async () => { await pool().end(); });`.
- After completing this plan, **Plan 2 (eval execution UI) will build on the same `dalgo_eval_cases` table.** Don't drop these tables when iterating.

---

## File Structure

**Create:**
- `lib/db/queries/eval-cases.ts` — typed CRUD + version queries
- `lib/llm/eval/case-source.ts` — cached reader (mirror of `lib/llm/prompts.ts`)
- `scripts/migrations/003_eval_cases.sql` — schema migration
- `scripts/seed-eval-cases.ts` — one-shot import from TS files into DB
- `app/api/admin/eval-cases/route.ts` — GET list + POST create
- `app/api/admin/eval-cases/[id]/route.ts` — GET / PUT / DELETE single
- `app/api/admin/eval-cases/[id]/versions/route.ts` — GET version history
- `app/admin/evals/page.tsx` — list page grouped by bucket
- `app/admin/evals/new/page.tsx` — create form
- `app/admin/evals/[id]/page.tsx` — edit form
- `components/admin/eval-case-editor.tsx` — reusable form
- `components/admin/eval-cases-table.tsx` — list table
- Tests for queries, case-source, API, and a basic smoke test for the runner

**Modify:**
- `lib/db/schema.sql` — append the two new tables (kept in sync with migration 003)
- `lib/llm/eval/runner.ts` — replace static imports with `getEvalCases()`
- `package.json` — add `seed:eval-cases` script
- `app/admin/page.tsx` — add link to `/admin/evals` in the admin nav

---

## Task 1: Schema + migration for eval cases tables

**Files:**
- Modify: `lib/db/schema.sql` (append after the existing prompts section)
- Create: `scripts/migrations/003_eval_cases.sql`
- Test: `tests/lib/db/eval-cases-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Create `tests/lib/db/eval-cases-schema.test.ts`:

```typescript
import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';

describe('dalgo_eval_cases schema', () => {
  it('table exists with required columns', async () => {
    const { rows } = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'dalgo_eval_cases'
        ORDER BY ordinal_position`,
    );
    const cols = rows.map((r) => r.column_name);
    for (const expected of [
      'id', 'case_key', 'bucket', 'input', 'expected', 'judges',
      'enabled', 'notes', 'created_at', 'updated_at', 'updated_by',
    ]) {
      expect(cols).toContain(expected);
    }
  });

  it('dalgo_eval_case_versions table exists', async () => {
    const { rows } = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'dalgo_eval_case_versions'
        ORDER BY ordinal_position`,
    );
    const cols = rows.map((r) => r.column_name);
    for (const expected of [
      'id', 'case_id', 'case_key', 'bucket', 'input', 'expected', 'judges',
      'enabled', 'notes', 'updated_by', 'updated_at',
    ]) {
      expect(cols).toContain(expected);
    }
  });

  it('case_key is unique across active cases', async () => {
    const { rows } = await query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM pg_indexes
        WHERE tablename = 'dalgo_eval_cases'
          AND indexdef ILIKE '%UNIQUE%case_key%'`,
    );
    expect(rows[0].count).toBeGreaterThanOrEqual(1);
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- tests/lib/db/eval-cases-schema.test.ts`
Expected: FAIL with "relation does not exist" or missing columns.

- [ ] **Step 3: Create migration 003**

Create `scripts/migrations/003_eval_cases.sql`:

```sql
-- 003_eval_cases.sql
-- Add dalgo_eval_cases + dalgo_eval_case_versions, mirroring the prompts pattern.

CREATE TABLE IF NOT EXISTS dalgo_eval_cases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_key      text NOT NULL,
  bucket        text NOT NULL,
  input         text NOT NULL,
  expected      jsonb NOT NULL DEFAULT '{}'::jsonb,
  judges        text[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled       boolean NOT NULL DEFAULT TRUE,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_by    text NOT NULL DEFAULT 'system'
);

CREATE UNIQUE INDEX IF NOT EXISTS dalgo_eval_cases_case_key_uniq
  ON dalgo_eval_cases(case_key);

CREATE INDEX IF NOT EXISTS dalgo_eval_cases_bucket_idx
  ON dalgo_eval_cases(bucket);

CREATE TABLE IF NOT EXISTS dalgo_eval_case_versions (
  id          bigserial PRIMARY KEY,
  case_id     uuid NOT NULL REFERENCES dalgo_eval_cases(id) ON DELETE CASCADE,
  case_key    text NOT NULL,
  bucket      text NOT NULL,
  input       text NOT NULL,
  expected    jsonb NOT NULL,
  judges      text[] NOT NULL,
  enabled     boolean NOT NULL,
  notes       text,
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dalgo_eval_case_versions_case_id_idx
  ON dalgo_eval_case_versions(case_id, updated_at DESC);
```

- [ ] **Step 4: Apply the migration**

Run: `docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery < scripts/migrations/003_eval_cases.sql`
Expected: `CREATE TABLE`, `CREATE INDEX` notices, no errors.

- [ ] **Step 5: Append the same DDL to `lib/db/schema.sql`**

Append to the end of `lib/db/schema.sql` (after the existing prompts section):

```sql
-- ============================================================
-- Eval cases (migration 003 — kept in sync with this schema file)
-- ============================================================

CREATE TABLE IF NOT EXISTS dalgo_eval_cases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_key      text NOT NULL,
  bucket        text NOT NULL,
  input         text NOT NULL,
  expected      jsonb NOT NULL DEFAULT '{}'::jsonb,
  judges        text[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled       boolean NOT NULL DEFAULT TRUE,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_by    text NOT NULL DEFAULT 'system'
);

CREATE UNIQUE INDEX IF NOT EXISTS dalgo_eval_cases_case_key_uniq
  ON dalgo_eval_cases(case_key);

CREATE INDEX IF NOT EXISTS dalgo_eval_cases_bucket_idx
  ON dalgo_eval_cases(bucket);

CREATE TABLE IF NOT EXISTS dalgo_eval_case_versions (
  id          bigserial PRIMARY KEY,
  case_id     uuid NOT NULL REFERENCES dalgo_eval_cases(id) ON DELETE CASCADE,
  case_key    text NOT NULL,
  bucket      text NOT NULL,
  input       text NOT NULL,
  expected    jsonb NOT NULL,
  judges      text[] NOT NULL,
  enabled     boolean NOT NULL,
  notes       text,
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dalgo_eval_case_versions_case_id_idx
  ON dalgo_eval_case_versions(case_id, updated_at DESC);
```

- [ ] **Step 6: Re-run the test to confirm it passes**

Run: `npm test -- tests/lib/db/eval-cases-schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/migrations/003_eval_cases.sql lib/db/schema.sql tests/lib/db/eval-cases-schema.test.ts
git commit -m "feat(eval): schema + migration for dalgo_eval_cases + versions"
```

---

## Task 2: Queries layer for eval cases

**Files:**
- Create: `lib/db/queries/eval-cases.ts`
- Test: `tests/lib/db/eval-cases.test.ts`

- [ ] **Step 1: Write the failing queries test**

Create `tests/lib/db/eval-cases.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import {
  createEvalCase, getEvalCase, getEvalCaseByKey, listEvalCases,
  updateEvalCase, deleteEvalCase, listEvalCaseVersions,
} from '@/lib/db/queries/eval-cases';

describe('eval-cases queries', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_cases WHERE case_key LIKE 'qtest_%'`);
  });

  it('creates and reads a case', async () => {
    const id = await createEvalCase({
      case_key: 'qtest_basic',
      bucket: 'citations',
      input: 'Does Dalgo support X?',
      expected: { must_cite_one_of: ['https://example.com'] },
      judges: ['retrieval-judge'],
      enabled: true,
      notes: 'created by test',
      updated_by: 'test@example.com',
    });
    expect(id).toMatch(/[0-9a-f-]{36}/);

    const row = await getEvalCase(id);
    expect(row?.case_key).toBe('qtest_basic');
    expect(row?.bucket).toBe('citations');
    expect(row?.expected).toEqual({ must_cite_one_of: ['https://example.com'] });
    expect(row?.judges).toEqual(['retrieval-judge']);
  });

  it('looks up by case_key', async () => {
    await createEvalCase({
      case_key: 'qtest_lookup',
      bucket: 'guardrails',
      input: 'x',
      expected: {},
      judges: ['llm-judge'],
      enabled: true,
      notes: null,
      updated_by: 'test',
    });
    const row = await getEvalCaseByKey('qtest_lookup');
    expect(row?.bucket).toBe('guardrails');
  });

  it('list filters by bucket and enabled', async () => {
    await createEvalCase({ case_key: 'qtest_a', bucket: 'structure', input: 'a', expected: {}, judges: ['llm-judge'], enabled: true, notes: null, updated_by: 'test' });
    await createEvalCase({ case_key: 'qtest_b', bucket: 'structure', input: 'b', expected: {}, judges: ['llm-judge'], enabled: false, notes: null, updated_by: 'test' });

    const all = await listEvalCases({ bucket: 'structure' });
    const keys = all.map((r) => r.case_key).filter((k) => k.startsWith('qtest_'));
    expect(keys).toContain('qtest_a');
    expect(keys).toContain('qtest_b');

    const enabledOnly = await listEvalCases({ bucket: 'structure', enabledOnly: true });
    const enabledKeys = enabledOnly.map((r) => r.case_key).filter((k) => k.startsWith('qtest_'));
    expect(enabledKeys).toContain('qtest_a');
    expect(enabledKeys).not.toContain('qtest_b');
  });

  it('update writes a version row and bumps updated_at', async () => {
    const id = await createEvalCase({
      case_key: 'qtest_versioned', bucket: 'citations', input: 'v1',
      expected: {}, judges: ['retrieval-judge'], enabled: true, notes: null, updated_by: 'test',
    });
    await new Promise((r) => setTimeout(r, 5));
    await updateEvalCase(id, {
      input: 'v2',
      expected: { must_cite_one_of: ['https://x'] },
      judges: ['retrieval-judge', 'llm-judge'],
      enabled: true,
      notes: 'rev2',
      updated_by: 'test',
    });
    const after = await getEvalCase(id);
    expect(after?.input).toBe('v2');
    expect(after?.judges.length).toBe(2);

    const versions = await listEvalCaseVersions(id);
    // initial create writes v1 + update writes v2 = 2 rows
    expect(versions.length).toBe(2);
    expect(versions[0].input).toBe('v2'); // newest first
    expect(versions[1].input).toBe('v1');
  });

  it('delete removes the case', async () => {
    const id = await createEvalCase({
      case_key: 'qtest_del', bucket: 'citations', input: 'x', expected: {},
      judges: ['retrieval-judge'], enabled: true, notes: null, updated_by: 'test',
    });
    await deleteEvalCase(id);
    const row = await getEvalCase(id);
    expect(row).toBeNull();
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- tests/lib/db/eval-cases.test.ts`
Expected: FAIL with "Cannot find module '@/lib/db/queries/eval-cases'".

- [ ] **Step 3: Implement the queries**

Create `lib/db/queries/eval-cases.ts`:

```typescript
import { query, withClient } from '@/lib/db/client';

export interface EvalCaseRow {
  id: string;
  case_key: string;
  bucket: string;
  input: string;
  expected: Record<string, unknown>;
  judges: string[];
  enabled: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  updated_by: string;
}

export interface EvalCaseInput {
  case_key: string;
  bucket: string;
  input: string;
  expected: Record<string, unknown>;
  judges: string[];
  enabled: boolean;
  notes: string | null;
  updated_by: string;
}

export interface EvalCasePatch {
  input?: string;
  expected?: Record<string, unknown>;
  judges?: string[];
  enabled?: boolean;
  notes?: string | null;
  bucket?: string;
  updated_by: string;
}

export interface EvalCaseVersionRow {
  id: number;
  case_id: string;
  case_key: string;
  bucket: string;
  input: string;
  expected: Record<string, unknown>;
  judges: string[];
  enabled: boolean;
  notes: string | null;
  updated_by: string;
  updated_at: Date;
}

export async function createEvalCase(input: EvalCaseInput): Promise<string> {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO dalgo_eval_cases
           (case_key, bucket, input, expected, judges, enabled, notes, updated_by)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)
         RETURNING id`,
        [input.case_key, input.bucket, input.input, JSON.stringify(input.expected),
         input.judges, input.enabled, input.notes, input.updated_by],
      );
      const id = ins.rows[0].id;
      await client.query(
        `INSERT INTO dalgo_eval_case_versions
           (case_id, case_key, bucket, input, expected, judges, enabled, notes, updated_by)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)`,
        [id, input.case_key, input.bucket, input.input,
         JSON.stringify(input.expected), input.judges, input.enabled,
         input.notes, input.updated_by],
      );
      await client.query('COMMIT');
      return id;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export async function getEvalCase(id: string): Promise<EvalCaseRow | null> {
  const { rows } = await query<EvalCaseRow>(
    `SELECT * FROM dalgo_eval_cases WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getEvalCaseByKey(case_key: string): Promise<EvalCaseRow | null> {
  const { rows } = await query<EvalCaseRow>(
    `SELECT * FROM dalgo_eval_cases WHERE case_key = $1`,
    [case_key],
  );
  return rows[0] ?? null;
}

export interface ListOptions {
  bucket?: string;
  enabledOnly?: boolean;
}

export async function listEvalCases(opts: ListOptions = {}): Promise<EvalCaseRow[]> {
  const wheres: string[] = [];
  const params: unknown[] = [];
  if (opts.bucket) { params.push(opts.bucket); wheres.push(`bucket = $${params.length}`); }
  if (opts.enabledOnly) { wheres.push(`enabled = TRUE`); }
  const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  const { rows } = await query<EvalCaseRow>(
    `SELECT * FROM dalgo_eval_cases ${whereSql} ORDER BY bucket, case_key`,
    params,
  );
  return rows;
}

export async function updateEvalCase(id: string, patch: EvalCasePatch): Promise<void> {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      // Read current row to compose the version snapshot
      const current = await client.query<EvalCaseRow>(
        `SELECT * FROM dalgo_eval_cases WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (current.rows.length === 0) throw new Error(`eval case ${id} not found`);
      const cur = current.rows[0];

      const next = {
        bucket: patch.bucket ?? cur.bucket,
        input: patch.input ?? cur.input,
        expected: patch.expected ?? cur.expected,
        judges: patch.judges ?? cur.judges,
        enabled: patch.enabled ?? cur.enabled,
        notes: patch.notes !== undefined ? patch.notes : cur.notes,
      };

      await client.query(
        `UPDATE dalgo_eval_cases
            SET bucket = $2, input = $3, expected = $4::jsonb,
                judges = $5, enabled = $6, notes = $7,
                updated_by = $8, updated_at = NOW()
          WHERE id = $1`,
        [id, next.bucket, next.input, JSON.stringify(next.expected),
         next.judges, next.enabled, next.notes, patch.updated_by],
      );

      await client.query(
        `INSERT INTO dalgo_eval_case_versions
           (case_id, case_key, bucket, input, expected, judges, enabled, notes, updated_by)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)`,
        [id, cur.case_key, next.bucket, next.input,
         JSON.stringify(next.expected), next.judges, next.enabled,
         next.notes, patch.updated_by],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export async function deleteEvalCase(id: string): Promise<void> {
  await query(`DELETE FROM dalgo_eval_cases WHERE id = $1`, [id]);
}

export async function listEvalCaseVersions(id: string): Promise<EvalCaseVersionRow[]> {
  const { rows } = await query<EvalCaseVersionRow>(
    `SELECT * FROM dalgo_eval_case_versions
      WHERE case_id = $1
      ORDER BY updated_at DESC`,
    [id],
  );
  return rows;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- tests/lib/db/eval-cases.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/eval-cases.ts tests/lib/db/eval-cases.test.ts
git commit -m "feat(eval): typed CRUD queries for eval cases with versioning"
```

---

## Task 3: Cached case source (the read path for the runner)

**Files:**
- Create: `lib/llm/eval/case-source.ts`
- Test: `tests/lib/llm/eval/case-source.test.ts`

This mirrors `lib/llm/prompts.ts` (`getPrompt` + 60s TTL + `invalidatePromptCache`).

- [ ] **Step 1: Write the failing test**

Create `tests/lib/llm/eval/case-source.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { createEvalCase, deleteEvalCase } from '@/lib/db/queries/eval-cases';
import {
  getEvalCases, invalidateEvalCaseCache, __resetForTests, __cacheStatsForTests,
} from '@/lib/llm/eval/case-source';

describe('case-source cache', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_cases WHERE case_key LIKE 'csrc_%'`);
    __resetForTests();
  });

  it('returns cases for a bucket', async () => {
    const id = await createEvalCase({
      case_key: 'csrc_one', bucket: 'citations', input: 'x',
      expected: {}, judges: ['retrieval-judge'], enabled: true, notes: null, updated_by: 'test',
    });
    const cases = await getEvalCases('citations');
    expect(cases.some((c) => c.id === 'csrc_one')).toBe(true);
    await deleteEvalCase(id);
  });

  it('caches results within TTL', async () => {
    await createEvalCase({
      case_key: 'csrc_cache', bucket: 'guardrails', input: 'x',
      expected: {}, judges: ['llm-judge'], enabled: true, notes: null, updated_by: 'test',
    });
    await getEvalCases('guardrails');
    const stats1 = __cacheStatsForTests();
    expect(stats1.hits + stats1.misses).toBeGreaterThan(0);
    await getEvalCases('guardrails');
    const stats2 = __cacheStatsForTests();
    expect(stats2.hits).toBeGreaterThan(stats1.hits);
  });

  it('cache invalidation forces a refetch', async () => {
    await createEvalCase({
      case_key: 'csrc_inv', bucket: 'structure', input: 'x',
      expected: {}, judges: ['llm-judge'], enabled: true, notes: null, updated_by: 'test',
    });
    await getEvalCases('structure'); // populate cache
    invalidateEvalCaseCache('structure');
    await getEvalCases('structure');
    const stats = __cacheStatsForTests();
    expect(stats.misses).toBeGreaterThanOrEqual(2);
  });

  it('returns all enabled cases when no bucket given', async () => {
    await createEvalCase({
      case_key: 'csrc_all1', bucket: 'citations', input: 'x',
      expected: {}, judges: ['retrieval-judge'], enabled: true, notes: null, updated_by: 'test',
    });
    await createEvalCase({
      case_key: 'csrc_all2', bucket: 'guardrails', input: 'x',
      expected: {}, judges: ['llm-judge'], enabled: false, notes: null, updated_by: 'test',
    });
    const cases = await getEvalCases();
    const keys = cases.map((c) => c.id);
    expect(keys).toContain('csrc_all1');
    expect(keys).not.toContain('csrc_all2'); // disabled cases excluded
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run test to confirm fail**

Run: `npm test -- tests/lib/llm/eval/case-source.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the case-source**

Create `lib/llm/eval/case-source.ts`:

```typescript
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

export function __resetForTests(): void {
  cache.clear();
  hits = 0;
  misses = 0;
}

export function __cacheStatsForTests(): { hits: number; misses: number; size: number } {
  return { hits, misses, size: cache.size };
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm test -- tests/lib/llm/eval/case-source.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/llm/eval/case-source.ts tests/lib/llm/eval/case-source.test.ts
git commit -m "feat(eval): cached case-source reader with 60s TTL"
```

---

## Task 4: One-shot seed script — import TS cases into DB

**Files:**
- Create: `scripts/seed-eval-cases.ts`
- Modify: `package.json` (add `seed:eval-cases` script)

The TS files we read from (already exist):
- `lib/llm/eval/cases/citations.ts`
- `lib/llm/eval/cases/guardrails.ts`
- `lib/llm/eval/cases/problem-statements.ts`
- `lib/llm/eval/cases/structure.ts`
- `lib/llm/eval/cases/tool-names.ts`

Each file exports `CASES: EvalCase[]`.

- [ ] **Step 1: Add the npm script**

Edit `package.json` and add to `"scripts"`:

```json
"seed:eval-cases": "DOTENV_CONFIG_PATH=.env.local tsx scripts/seed-eval-cases.ts"
```

(Confirm `tsx` is in devDependencies; if not, use whatever existing seed scripts use — e.g. `seed:kb` uses `tsx`.)

- [ ] **Step 2: Write the seed script**

Create `scripts/seed-eval-cases.ts`:

```typescript
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { createEvalCase, getEvalCaseByKey } from '@/lib/db/queries/eval-cases';
import { CASES as CITATIONS } from '@/lib/llm/eval/cases/citations';
import { CASES as GUARDRAILS } from '@/lib/llm/eval/cases/guardrails';
import { CASES as PROBLEM_STATEMENTS } from '@/lib/llm/eval/cases/problem-statements';
import { CASES as STRUCTURE } from '@/lib/llm/eval/cases/structure';
import { CASES as TOOL_NAMES } from '@/lib/llm/eval/cases/tool-names';
import type { EvalCase } from '@/lib/llm/eval/cases/types';

const ALL: EvalCase[] = [
  ...CITATIONS,
  ...GUARDRAILS,
  ...PROBLEM_STATEMENTS,
  ...STRUCTURE,
  ...TOOL_NAMES,
];

async function main() {
  let created = 0;
  let skipped = 0;
  for (const c of ALL) {
    const existing = await getEvalCaseByKey(c.id);
    if (existing) { skipped++; continue; }
    await createEvalCase({
      case_key: c.id,
      bucket: c.bucket,
      input: c.input,
      expected: c.expected as Record<string, unknown>,
      judges: c.judge,
      enabled: true,
      notes: null,
      updated_by: 'seed',
    });
    created++;
  }
  console.log(`Seeded eval cases. created=${created} skipped=${skipped} total_source=${ALL.length}`);
  await pool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the seed script**

Run: `npm run seed:eval-cases`
Expected output: `Seeded eval cases. created=50 skipped=0 total_source=50` (the count may differ if your TS files have more or fewer cases; whatever the file count is, `created` should equal `total_source` on the first run).

- [ ] **Step 4: Confirm rows are in the DB**

Run: `docker exec dalgo-discovery-db psql -U dalgo -d dalgo_discovery -c "SELECT bucket, COUNT(*) FROM dalgo_eval_cases GROUP BY bucket ORDER BY bucket;"`
Expected: a row per bucket (citations, guardrails, problem-statement, structure, tool-names) with counts that match the source TS files.

- [ ] **Step 5: Re-run to confirm idempotency**

Run: `npm run seed:eval-cases`
Expected: `created=0 skipped=50` (all already exist; nothing is created on second run).

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-eval-cases.ts package.json
git commit -m "feat(eval): one-shot seed script to import TS cases into DB"
```

---

## Task 5: Update runner.ts to use case-source

**Files:**
- Modify: `lib/llm/eval/runner.ts`
- Test: `tests/lib/llm/eval/runner-uses-db.test.ts`

We keep the TS files as the source of truth for the seed script but the runner no longer imports them directly — it always reads from `getEvalCases()`.

- [ ] **Step 1: Write a failing integration test**

Create `tests/lib/llm/eval/runner-uses-db.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { createEvalCase } from '@/lib/db/queries/eval-cases';
import { __resetForTests as resetCases } from '@/lib/llm/eval/case-source';
import { runOne } from '@/lib/llm/eval/runner';

describe('runner reads from DB', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_cases WHERE case_key LIKE 'runner_%'`);
    resetCases();
  });

  it('runOne can execute a case stored in the DB', async () => {
    await createEvalCase({
      case_key: 'runner_smoke',
      bucket: 'guardrails',
      input: 'What is two plus two?',  // off-topic guardrail trigger
      expected: { must_express_uncertainty: true },
      judges: ['llm-judge'],
      enabled: true,
      notes: 'smoke test',
      updated_by: 'test',
    });
    const result = await runOne('runner_smoke');
    expect(result.id).toBe('runner_smoke');
    expect(result.bucket).toBe('guardrails');
    expect(typeof result.pass).toBe('boolean');
    expect(Array.isArray(result.judgeResults)).toBe(true);
  }, 60_000); // LLM call - allow up to 1 min

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run test to confirm fail**

Run: `npm test -- tests/lib/llm/eval/runner-uses-db.test.ts`
Expected: FAIL — `runOne` probably looks up by ID in an in-memory array, not the DB.

- [ ] **Step 3: Read the current `runner.ts`**

Open `lib/llm/eval/runner.ts`. Identify:
- Where `CASES` are statically imported (likely concatenated at module top)
- The `runOne(id)` function signature
- The `runAll()` function

Note exact line numbers for the static imports and the lookup logic.

- [ ] **Step 4: Replace static imports with case-source**

Modify `lib/llm/eval/runner.ts`:

Remove the lines that read like:
```typescript
import { CASES as CITATIONS } from './cases/citations';
import { CASES as GUARDRAILS } from './cases/guardrails';
// ... etc
const ALL_CASES = [...CITATIONS, ...GUARDRAILS, /* ... */];
```

Add at the top:
```typescript
import { getEvalCases } from './case-source';
```

Modify `runOne(id: string)` to fetch via `getEvalCases()`:

```typescript
export async function runOne(id: string): Promise<RunResult> {
  const cases = await getEvalCases();
  const target = cases.find((c) => c.id === id);
  if (!target) throw new Error(`unknown eval case: ${id}`);
  return runCase(target);
}
```

Modify `runAll()`:

```typescript
export async function runAll(): Promise<RunResult[]> {
  const cases = await getEvalCases();
  const results: RunResult[] = [];
  for (const c of cases) {
    results.push(await runCase(c));
  }
  return results;
}
```

(Where `runCase(case)` is the existing per-case execution function — leave it alone.)

- [ ] **Step 5: Run the integration test**

Run: `npm test -- tests/lib/llm/eval/runner-uses-db.test.ts`
Expected: PASS (1 test). Note: this hits the real LLM and costs ~$0.01.

- [ ] **Step 6: Run the full existing eval suite to confirm no regression**

Run: `npm run eval`
Expected: passes at the same rate as before. (Same cases, now loaded from DB instead of TS — the result should be identical.)

If the pass rate dropped: read the resulting report at `docs/eval-runs/<timestamp>.md`. Compare with the most recent prior run (e.g. `docs/eval-runs/2026-05-26-18-08.md`). Diagnose: is it a flaky case or did the DB load lose data? Verify each bucket count matches.

- [ ] **Step 7: Commit**

```bash
git add lib/llm/eval/runner.ts tests/lib/llm/eval/runner-uses-db.test.ts
git commit -m "feat(eval): runner reads cases from DB via case-source"
```

---

## Task 6: API — list + create

**Files:**
- Create: `app/api/admin/eval-cases/route.ts`
- Test: `tests/api/admin/eval-cases.test.ts`

- [ ] **Step 1: Write the failing API test**

Create `tests/api/admin/eval-cases.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { GET, POST } from '@/app/api/admin/eval-cases/route';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com', isSystem: false } }),
}));

describe('GET /api/admin/eval-cases', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_cases WHERE case_key LIKE 'api_%'`);
  });

  it('returns list of cases', async () => {
    await query(
      `INSERT INTO dalgo_eval_cases (case_key, bucket, input, expected, judges, updated_by)
       VALUES ('api_one', 'citations', 'x', '{}', ARRAY['retrieval-judge'], 'seed')`,
    );
    const req = new Request('http://localhost/api/admin/eval-cases');
    const res = await GET(req as unknown as Request);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.cases)).toBe(true);
    expect(body.cases.some((c: { case_key: string }) => c.case_key === 'api_one')).toBe(true);
  });

  it('supports bucket filter via ?bucket=', async () => {
    await query(
      `INSERT INTO dalgo_eval_cases (case_key, bucket, input, expected, judges, updated_by)
       VALUES ('api_filter', 'guardrails', 'x', '{}', ARRAY['llm-judge'], 'seed')`,
    );
    const req = new Request('http://localhost/api/admin/eval-cases?bucket=guardrails');
    const res = await GET(req as unknown as Request);
    const body = await res.json();
    expect(body.cases.every((c: { bucket: string }) => c.bucket === 'guardrails')).toBe(true);
  });

  it('POST creates a new case', async () => {
    const req = new Request('http://localhost/api/admin/eval-cases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        case_key: 'api_created',
        bucket: 'guardrails',
        input: 'test input',
        expected: { must_express_uncertainty: true },
        judges: ['llm-judge'],
        enabled: true,
        notes: null,
      }),
    });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('POST rejects missing required fields', async () => {
    const req = new Request('http://localhost/api/admin/eval-cases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ case_key: 'incomplete' }),
    });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(400);
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run the test to confirm fail**

Run: `npm test -- tests/api/admin/eval-cases.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the route**

Create `app/api/admin/eval-cases/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listEvalCases, createEvalCase } from '@/lib/db/queries/eval-cases';
import { invalidateEvalCaseCache } from '@/lib/llm/eval/case-source';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const bucket = url.searchParams.get('bucket') ?? undefined;
  const enabledOnly = url.searchParams.get('enabledOnly') === 'true';
  const cases = await listEvalCases({ bucket, enabledOnly });
  return NextResponse.json({ cases });
}

interface CreateBody {
  case_key?: unknown;
  bucket?: unknown;
  input?: unknown;
  expected?: unknown;
  judges?: unknown;
  enabled?: unknown;
  notes?: unknown;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (typeof body.case_key !== 'string' || !body.case_key.length)
    return NextResponse.json({ error: 'case_key required' }, { status: 400 });
  if (typeof body.bucket !== 'string' || !body.bucket.length)
    return NextResponse.json({ error: 'bucket required' }, { status: 400 });
  if (typeof body.input !== 'string' || !body.input.length)
    return NextResponse.json({ error: 'input required' }, { status: 400 });
  if (!Array.isArray(body.judges) || body.judges.length === 0)
    return NextResponse.json({ error: 'judges must be a non-empty array' }, { status: 400 });

  const expected = body.expected && typeof body.expected === 'object'
    ? (body.expected as Record<string, unknown>)
    : {};

  const id = await createEvalCase({
    case_key: body.case_key,
    bucket: body.bucket,
    input: body.input,
    expected,
    judges: body.judges as string[],
    enabled: body.enabled !== false,
    notes: typeof body.notes === 'string' ? body.notes : null,
    updated_by: session.user.email ?? 'admin',
  });

  invalidateEvalCaseCache(body.bucket);
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 4: Run the test to confirm pass**

Run: `npm test -- tests/api/admin/eval-cases.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/eval-cases/route.ts tests/api/admin/eval-cases.test.ts
git commit -m "feat(eval): admin API list + create endpoints for eval cases"
```

---

## Task 7: API — get/update/delete single

**Files:**
- Create: `app/api/admin/eval-cases/[id]/route.ts`
- Test: `tests/api/admin/eval-cases-id.test.ts`

- [ ] **Step 1: Write the failing API test**

Create `tests/api/admin/eval-cases-id.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { createEvalCase } from '@/lib/db/queries/eval-cases';
import { GET, PUT, DELETE } from '@/app/api/admin/eval-cases/[id]/route';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com', isSystem: false } }),
}));

describe('/api/admin/eval-cases/[id]', () => {
  let id: string;
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_cases WHERE case_key LIKE 'apiid_%'`);
    id = await createEvalCase({
      case_key: 'apiid_target', bucket: 'citations', input: 'x',
      expected: {}, judges: ['retrieval-judge'], enabled: true, notes: null, updated_by: 'seed',
    });
  });

  it('GET returns case', async () => {
    const req = new Request(`http://localhost/api/admin/eval-cases/${id}`);
    const res = await GET(req as unknown as Request, { params: Promise.resolve({ id }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.case.case_key).toBe('apiid_target');
  });

  it('GET 404 for missing', async () => {
    const fake = '00000000-0000-0000-0000-000000000000';
    const req = new Request(`http://localhost/api/admin/eval-cases/${fake}`);
    const res = await GET(req as unknown as Request, { params: Promise.resolve({ id: fake }) });
    expect(res.status).toBe(404);
  });

  it('PUT updates the case', async () => {
    const req = new Request(`http://localhost/api/admin/eval-cases/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: 'updated input', notes: 'rev2' }),
    });
    const res = await PUT(req as unknown as Request, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const { rows } = await query<{ input: string; notes: string | null }>(
      `SELECT input, notes FROM dalgo_eval_cases WHERE id = $1`, [id],
    );
    expect(rows[0].input).toBe('updated input');
    expect(rows[0].notes).toBe('rev2');
  });

  it('DELETE removes the case', async () => {
    const req = new Request(`http://localhost/api/admin/eval-cases/${id}`, { method: 'DELETE' });
    const res = await DELETE(req as unknown as Request, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(204);
    const { rows } = await query(`SELECT id FROM dalgo_eval_cases WHERE id = $1`, [id]);
    expect(rows.length).toBe(0);
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run test to confirm fail**

Run: `npm test -- tests/api/admin/eval-cases-id.test.ts`
Expected: FAIL — route not found.

- [ ] **Step 3: Implement the route**

Create `app/api/admin/eval-cases/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getEvalCase, updateEvalCase, deleteEvalCase,
} from '@/lib/db/queries/eval-cases';
import { invalidateEvalCaseCache } from '@/lib/llm/eval/case-source';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const row = await getEvalCase(id);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ case: row });
}

interface PutBody {
  input?: unknown;
  bucket?: unknown;
  expected?: unknown;
  judges?: unknown;
  enabled?: unknown;
  notes?: unknown;
}

export async function PUT(req: Request, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await getEvalCase(id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let body: PutBody;
  try { body = (await req.json()) as PutBody; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  await updateEvalCase(id, {
    input: typeof body.input === 'string' ? body.input : undefined,
    bucket: typeof body.bucket === 'string' ? body.bucket : undefined,
    expected: body.expected && typeof body.expected === 'object' ? (body.expected as Record<string, unknown>) : undefined,
    judges: Array.isArray(body.judges) ? (body.judges as string[]) : undefined,
    enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    notes: typeof body.notes === 'string' || body.notes === null ? (body.notes as string | null) : undefined,
    updated_by: session.user.email ?? 'admin',
  });
  invalidateEvalCaseCache(existing.bucket);
  if (typeof body.bucket === 'string' && body.bucket !== existing.bucket) {
    invalidateEvalCaseCache(body.bucket);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await getEvalCase(id);
  if (!existing) return new NextResponse(null, { status: 204 }); // idempotent
  await deleteEvalCase(id);
  invalidateEvalCaseCache(existing.bucket);
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 4: Run test to confirm pass**

Run: `npm test -- tests/api/admin/eval-cases-id.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/eval-cases/[id]/route.ts tests/api/admin/eval-cases-id.test.ts
git commit -m "feat(eval): admin API GET/PUT/DELETE per case"
```

---

## Task 8: API — version history

**Files:**
- Create: `app/api/admin/eval-cases/[id]/versions/route.ts`
- Test: append to existing `tests/api/admin/eval-cases-id.test.ts` OR create `tests/api/admin/eval-case-versions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/admin/eval-case-versions.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { createEvalCase, updateEvalCase } from '@/lib/db/queries/eval-cases';
import { GET } from '@/app/api/admin/eval-cases/[id]/versions/route';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com', isSystem: false } }),
}));

describe('GET versions', () => {
  let id: string;
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_cases WHERE case_key LIKE 'ver_%'`);
    id = await createEvalCase({
      case_key: 'ver_target', bucket: 'citations', input: 'v1',
      expected: {}, judges: ['retrieval-judge'], enabled: true, notes: null, updated_by: 'seed',
    });
    await new Promise((r) => setTimeout(r, 5));
    await updateEvalCase(id, { input: 'v2', updated_by: 'seed' });
  });

  it('returns versions newest first', async () => {
    const req = new Request(`http://localhost/api/admin/eval-cases/${id}/versions`);
    const res = await GET(req as unknown as Request, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versions.length).toBe(2);
    expect(body.versions[0].input).toBe('v2');
    expect(body.versions[1].input).toBe('v1');
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run, confirm fail, implement, confirm pass**

Run test (FAIL — route missing).

Create `app/api/admin/eval-cases/[id]/versions/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listEvalCaseVersions, getEvalCase } from '@/lib/db/queries/eval-cases';

interface RouteContext { params: Promise<{ id: string }>; }

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await getEvalCase(id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const versions = await listEvalCaseVersions(id);
  return NextResponse.json({ versions });
}
```

Run: `npm test -- tests/api/admin/eval-case-versions.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/eval-cases/[id]/versions/route.ts tests/api/admin/eval-case-versions.test.ts
git commit -m "feat(eval): admin API for case version history"
```

---

## Task 9: List page UI — `/admin/evals`

**Files:**
- Create: `app/admin/evals/page.tsx`
- Create: `components/admin/eval-cases-table.tsx`

- [ ] **Step 1: Build the table component**

Create `components/admin/eval-cases-table.tsx`:

```typescript
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface EvalCaseRow {
  id: string;
  case_key: string;
  bucket: string;
  input: string;
  enabled: boolean;
  updated_at: string;
  updated_by: string;
}

export function EvalCasesTable() {
  const [cases, setCases] = useState<EvalCaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/eval-cases')
      .then((r) => r.json())
      .then((data) => setCases(data.cases ?? []))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;

  const byBucket = cases.reduce<Record<string, EvalCaseRow[]>>((acc, c) => {
    (acc[c.bucket] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(byBucket).sort().map(([bucket, rows]) => (
        <section key={bucket}>
          <h2 className="text-lg font-semibold mb-2">{bucket} ({rows.length})</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Key</th>
                <th className="py-2 pr-4">Input</th>
                <th className="py-2 pr-4">Enabled</th>
                <th className="py-2 pr-4">Updated</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-mono text-xs">{c.case_key}</td>
                  <td className="py-2 pr-4">{c.input.slice(0, 80)}…</td>
                  <td className="py-2 pr-4">{c.enabled ? '✓' : '—'}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500">
                    {new Date(c.updated_at).toLocaleString()} by {c.updated_by}
                  </td>
                  <td className="py-2">
                    <Link href={`/admin/evals/${c.id}`} className="text-blue-600 hover:underline">Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Build the page**

Create `app/admin/evals/page.tsx`:

```typescript
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { EvalCasesTable } from '@/components/admin/eval-cases-table';

export default async function EvalsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <main className="max-w-6xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Eval Cases</h1>
          <p className="text-gray-600 text-sm">
            Test cases that grade the bot. Edit freely in building phase; run evals after batches.
          </p>
        </div>
        <Link
          href="/admin/evals/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          New case
        </Link>
      </header>
      <EvalCasesTable />
    </main>
  );
}
```

- [ ] **Step 3: Add nav link**

Modify `app/admin/page.tsx`. Find the existing admin nav (likely a section listing /admin/kb, /admin/prompts, etc.). Add:

```typescript
<Link href="/admin/evals" className="...same-classes-as-others...">Eval cases</Link>
```

(Exact classes depend on the existing admin nav style — match it.)

- [ ] **Step 4: Smoke test in browser**

Run: `npm run dev`

Visit: `http://localhost:3000/admin/evals` (after logging in as admin)

Expected: List of cases grouped by bucket, each row with edit link.

- [ ] **Step 5: Commit**

```bash
git add app/admin/evals/page.tsx components/admin/eval-cases-table.tsx app/admin/page.tsx
git commit -m "feat(eval): admin list page at /admin/evals"
```

---

## Task 10: Editor component — reusable form

**Files:**
- Create: `components/admin/eval-case-editor.tsx`

- [ ] **Step 1: Build the editor component**

Create `components/admin/eval-case-editor.tsx`:

```typescript
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface EvalCaseFormValue {
  case_key: string;
  bucket: string;
  input: string;
  expected: Record<string, unknown>;
  judges: string[];
  enabled: boolean;
  notes: string | null;
}

interface Props {
  initial: EvalCaseFormValue;
  mode: 'create' | 'edit';
  caseId?: string;
}

const BUCKETS = ['citations', 'guardrails', 'problem-statement', 'structure', 'tool-names'];
const JUDGES = ['retrieval-judge', 'llm-judge', 'exact-match'];

export function EvalCaseEditor({ initial, mode, caseId }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<EvalCaseFormValue>(initial);
  const [expectedJson, setExpectedJson] = useState(JSON.stringify(initial.expected, null, 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  async function save() {
    setError(null);
    let expected: Record<string, unknown>;
    try {
      expected = JSON.parse(expectedJson);
      setParseError(null);
    } catch (err) {
      setParseError(`Invalid JSON: ${String(err)}`);
      return;
    }

    setSaving(true);
    const payload = { ...value, expected };
    const url = mode === 'create' ? '/api/admin/eval-cases' : `/api/admin/eval-cases/${caseId}`;
    const method = mode === 'create' ? 'POST' : 'PUT';
    const res = await fetch(url, {
      method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
      return;
    }
    router.push('/admin/evals');
    router.refresh();
  }

  async function remove() {
    if (!caseId) return;
    if (!confirm('Delete this case?')) return;
    const res = await fetch(`/api/admin/eval-cases/${caseId}`, { method: 'DELETE' });
    if (res.ok) { router.push('/admin/evals'); router.refresh(); }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Field label="Case key (stable identifier)">
        <input
          className="border p-2 rounded w-full font-mono text-sm"
          value={value.case_key}
          onChange={(e) => setValue({ ...value, case_key: e.target.value })}
          disabled={mode === 'edit'}
          placeholder="e.g. cit_05"
        />
      </Field>

      <Field label="Bucket">
        <select
          className="border p-2 rounded w-full"
          value={value.bucket}
          onChange={(e) => setValue({ ...value, bucket: e.target.value })}
        >
          {BUCKETS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </Field>

      <Field label="User input (the message the bot is tested with)">
        <textarea
          className="border p-2 rounded w-full min-h-[100px]"
          value={value.input}
          onChange={(e) => setValue({ ...value, input: e.target.value })}
        />
      </Field>

      <Field label="Judges (one or more)">
        <div className="space-y-1">
          {JUDGES.map((j) => (
            <label key={j} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value.judges.includes(j)}
                onChange={(e) => {
                  setValue({
                    ...value,
                    judges: e.target.checked
                      ? [...value.judges, j]
                      : value.judges.filter((x) => x !== j),
                  });
                }}
              />
              <span className="font-mono text-sm">{j}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Expected (JSON)">
        <textarea
          className="border p-2 rounded w-full min-h-[180px] font-mono text-sm"
          value={expectedJson}
          onChange={(e) => setExpectedJson(e.target.value)}
        />
        {parseError && <p className="text-red-600 text-sm mt-1">{parseError}</p>}
        <p className="text-xs text-gray-500 mt-1">
          Common fields: must_cite_one_of (string[]), must_not_hallucinate_urls (boolean),
          must_express_uncertainty (boolean), must_record_unanswered (boolean),
          matched_pattern (string), structure (string[]).
        </p>
      </Field>

      <Field label="Notes (optional, for your team)">
        <textarea
          className="border p-2 rounded w-full"
          value={value.notes ?? ''}
          onChange={(e) => setValue({ ...value, notes: e.target.value || null })}
        />
      </Field>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => setValue({ ...value, enabled: e.target.checked })}
        />
        <span>Enabled (included in eval runs)</span>
      </label>

      {error && <p className="text-red-600">Error: {error}</p>}

      <div className="flex gap-2 pt-4">
        <button
          onClick={save}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : mode === 'create' ? 'Create case' : 'Save changes'}
        </button>
        {mode === 'edit' && (
          <button
            onClick={remove}
            className="border border-red-600 text-red-600 px-4 py-2 rounded hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}
```

- [ ] **Step 2: Commit (no test — pure UI; covered by manual smoke + e2e later)**

```bash
git add components/admin/eval-case-editor.tsx
git commit -m "feat(eval): reusable EvalCaseEditor form component"
```

---

## Task 11: New page — `/admin/evals/new`

**Files:**
- Create: `app/admin/evals/new/page.tsx`

- [ ] **Step 1: Build the page**

Create `app/admin/evals/new/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { EvalCaseEditor, type EvalCaseFormValue } from '@/components/admin/eval-case-editor';

const DEFAULT: EvalCaseFormValue = {
  case_key: '',
  bucket: 'citations',
  input: '',
  expected: { must_cite_one_of: [] },
  judges: ['retrieval-judge'],
  enabled: true,
  notes: null,
};

export default async function NewEvalCasePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">New eval case</h1>
      <EvalCaseEditor initial={DEFAULT} mode="create" />
    </main>
  );
}
```

- [ ] **Step 2: Smoke test in browser**

Visit `http://localhost:3000/admin/evals/new`. Fill in fields. Submit. Expect redirect to `/admin/evals` with the new case visible.

- [ ] **Step 3: Commit**

```bash
git add app/admin/evals/new/page.tsx
git commit -m "feat(eval): new case page at /admin/evals/new"
```

---

## Task 12: Edit page — `/admin/evals/[id]`

**Files:**
- Create: `app/admin/evals/[id]/page.tsx`

- [ ] **Step 1: Build the page**

Create `app/admin/evals/[id]/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getEvalCase, listEvalCaseVersions } from '@/lib/db/queries/eval-cases';
import { EvalCaseEditor, type EvalCaseFormValue } from '@/components/admin/eval-case-editor';

interface PageProps { params: Promise<{ id: string }>; }

export default async function EditEvalCasePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { id } = await params;
  const row = await getEvalCase(id);
  if (!row) notFound();

  const initial: EvalCaseFormValue = {
    case_key: row.case_key,
    bucket: row.bucket,
    input: row.input,
    expected: row.expected,
    judges: row.judges,
    enabled: row.enabled,
    notes: row.notes,
  };

  const versions = await listEvalCaseVersions(id);

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">{row.case_key}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Bucket: <span className="font-mono">{row.bucket}</span>
        {' · '}
        Last updated: {new Date(row.updated_at).toLocaleString()} by {row.updated_by}
      </p>

      <EvalCaseEditor initial={initial} mode="edit" caseId={id} />

      <section className="mt-12">
        <h2 className="text-lg font-semibold mb-3">Version history ({versions.length})</h2>
        <ul className="space-y-2 text-sm">
          {versions.map((v) => (
            <li key={v.id} className="border rounded p-3">
              <div className="text-xs text-gray-500">
                {new Date(v.updated_at).toLocaleString()} by {v.updated_by}
              </div>
              <div className="mt-1">{v.input.slice(0, 200)}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Smoke test**

Visit `/admin/evals/<some-id>`. Edit a field. Save. Expect updated row + a new version entry in the history section.

- [ ] **Step 3: Commit**

```bash
git add app/admin/evals/[id]/page.tsx
git commit -m "feat(eval): edit case page with version history"
```

---

## Task 13: Final smoke + verify nothing regressed

- [ ] **Step 1: Run the eval suite end-to-end**

Run: `npm run eval`
Expected: passes at the same rate it did before this work. The cases are now coming from the DB but they were seeded from the same TS files, so quality should be identical.

- [ ] **Step 2: Check the eval-run report**

Open the latest file in `docs/eval-runs/`. Verify case counts per bucket match the source TS files.

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Lint + build**

Run: `npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 5: Final commit if any leftover changes**

```bash
git status
# if anything is uncommitted:
git add .
git commit -m "chore(eval): cleanup after eval cases DB migration"
```

---

## Notes for Plan 2 (eval execution UI)

After this plan, `dalgo_eval_cases` is the source of truth and the runner reads from it. Plan 2 will:
- Add `dalgo_eval_runs` + `dalgo_eval_run_results` tables
- Refactor `runner.ts` into a callable service (currently it's mostly called from tests)
- Add `/admin/evals/runs/*` pages
- Add a "Test this case" button on the edit page that calls a new POST endpoint

The TS files in `lib/llm/eval/cases/*.ts` can stay as a backup but are no longer authoritative. They're useful as a seed source if you ever reset the DB.
