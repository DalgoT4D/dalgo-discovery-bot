# KB enhancements: paste-import + versioning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two enhancements to the existing `/admin/kb` flow:
1. **Paste-to-Q&A import** — admin pastes raw text (short or long), an LLM proposes Q&A pairs, admin reviews and approves what becomes new KB entries.
2. **Lightweight KB versioning** — every KB edit writes a version row; the edit page shows history with one-click restore. (Mirrors the existing `dalgo_prompts` pattern.)

**Architecture:**
- **Versioning**: new `dalgo_kb_versions` table (mirror of `dalgo_prompt_versions`). The existing `PATCH /api/admin/kb/[id]` route is wrapped in a transaction that also inserts a version snapshot. A new GET `/api/admin/kb/[id]/versions` returns history. A new POST `/api/admin/kb/[id]/versions/[versionId]/restore` copies a chosen version back onto the current row (and re-embeds).
- **Paste-import**: new page `/admin/kb/import` with a textarea. POST `/api/admin/kb/extract-qa` calls Claude Haiku (cheap, ~$0.005/call) to extract Q&A pairs from the pasted text in a structured JSON shape. The admin reviews the proposals (edit / discard each), then approves — each approved item is saved through the existing `POST /api/admin/kb` route (which already embeds).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, raw `pg` Pool, NextAuth v5, Tailwind v4, Vercel AI SDK v4 + Anthropic.

**Spec:** This plan is the spec.

**Branch:** `feat/blog-ingestion` (continue commits; do NOT push to remote without explicit user instruction).

**Pre-flight expectations:**
- Postgres container `dalgo-discovery-db` up. Apply migrations via `docker exec -i dalgo-discovery-db psql ...`.
- `.env.local` has `DATABASE_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.
- **Independent of Plans 1 + 2.** This plan only touches KB code and can be built in any order relative to the eval work.
- Existing reference: `lib/llm/prompts.ts` and `app/api/admin/prompts/[key]/route.ts` are the templates for the versioning pattern.
- Single test: `npm test -- tests/lib/db/kb-versions.test.ts`
- All tests: `npm test`

---

## File Structure

**Create:**
- `lib/db/queries/kb-versions.ts` — version queries
- `lib/llm/extract-qa.ts` — LLM helper that turns pasted text into Q&A pairs
- `scripts/migrations/005_kb_versions.sql`
- `app/api/admin/kb/[id]/versions/route.ts`
- `app/api/admin/kb/[id]/versions/[versionId]/restore/route.ts`
- `app/api/admin/kb/extract-qa/route.ts`
- `app/admin/kb/import/page.tsx`
- `components/admin/kb-import.tsx` — paste UI + review of proposed entries
- `components/admin/kb-versions-panel.tsx` — history panel for the edit page
- Tests for the LLM helper, the queries, and the APIs

**Modify:**
- `lib/db/schema.sql` — append `dalgo_kb_versions`
- `app/api/admin/kb/[id]/route.ts` — write a version snapshot inside the existing PATCH transaction
- `app/admin/kb/[id]/page.tsx` — show the `<KbVersionsPanel />` below the editor
- `app/admin/kb/page.tsx` — add "Import via paste" button next to "New entry"

---

## Task 1: Schema + migration for kb_versions

**Files:**
- Modify: `lib/db/schema.sql`
- Create: `scripts/migrations/005_kb_versions.sql`
- Test: `tests/lib/db/kb-versions-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Create `tests/lib/db/kb-versions-schema.test.ts`:

```typescript
import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';

describe('dalgo_kb_versions schema', () => {
  it('table exists with required columns', async () => {
    const { rows } = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'dalgo_kb_versions'
        ORDER BY ordinal_position`,
    );
    const cols = rows.map((r) => r.column_name);
    for (const c of [
      'id', 'kb_id', 'category', 'question_variants', 'canonical_answer',
      'status', 'ngo_framing', 'evidence', 'notes_for_sales',
      'updated_by', 'updated_at',
    ]) {
      expect(cols).toContain(c);
    }
  });

  it('has an index on (kb_id, updated_at DESC)', async () => {
    const { rows } = await query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM pg_indexes
        WHERE tablename = 'dalgo_kb_versions'`,
    );
    expect(rows[0].count).toBeGreaterThanOrEqual(1);
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- tests/lib/db/kb-versions-schema.test.ts`
Expected: FAIL (table does not exist).

- [ ] **Step 3: Create migration 005**

Create `scripts/migrations/005_kb_versions.sql`:

```sql
-- 005_kb_versions.sql
-- Append-only version history for KB entries.
-- Schema mirrors the columns of dalgo_knowledge_base that we want to snapshot
-- (we deliberately omit `embedding` from versions — it'd waste storage; we
-- re-embed on restore from the snapshot text instead).

CREATE TABLE IF NOT EXISTS dalgo_kb_versions (
  id                bigserial PRIMARY KEY,
  kb_id             uuid NOT NULL REFERENCES dalgo_knowledge_base(id) ON DELETE CASCADE,
  category          text NOT NULL,
  question_variants text[] NOT NULL,
  canonical_answer  text NOT NULL,
  status            text,
  ngo_framing       text,
  evidence          text[],
  notes_for_sales   text,
  updated_by        text NOT NULL,
  updated_at        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dalgo_kb_versions_kb_id_idx
  ON dalgo_kb_versions(kb_id, updated_at DESC);
```

- [ ] **Step 4: Apply migration**

Run: `docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery < scripts/migrations/005_kb_versions.sql`
Expected: `CREATE TABLE`, `CREATE INDEX` notices.

- [ ] **Step 5: Append identical DDL to `lib/db/schema.sql`**

Append to `lib/db/schema.sql` (under a comment header `-- KB versioning (migration 005)`).

- [ ] **Step 6: Re-run test to confirm pass**

Run: `npm test -- tests/lib/db/kb-versions-schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/migrations/005_kb_versions.sql lib/db/schema.sql tests/lib/db/kb-versions-schema.test.ts
git commit -m "feat(kb): schema for kb version snapshots"
```

---

## Task 2: Queries layer for KB versions

**Files:**
- Create: `lib/db/queries/kb-versions.ts`
- Test: `tests/lib/db/kb-versions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/db/kb-versions.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import {
  insertKbVersion, listKbVersions, getKbVersion,
} from '@/lib/db/queries/kb-versions';

async function createTestKbRow(): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO dalgo_knowledge_base
       (category, question_variants, canonical_answer, status, source, updated_at)
     VALUES ('data_sources', ARRAY['v1 q'], 'v1 answer', 'yes', 'admin_manual', NOW())
     RETURNING id`,
  );
  return rows[0].id;
}

describe('kb-versions queries', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_knowledge_base WHERE canonical_answer LIKE 'v_ test%'`);
  });

  it('inserts and lists versions newest first', async () => {
    const kbId = await createTestKbRow();
    await insertKbVersion(kbId, {
      category: 'data_sources',
      question_variants: ['q1'],
      canonical_answer: 'v_ test 1',
      status: 'yes',
      ngo_framing: null,
      evidence: [],
      notes_for_sales: null,
      updated_by: 'test',
    });
    await new Promise((r) => setTimeout(r, 5));
    await insertKbVersion(kbId, {
      category: 'data_sources',
      question_variants: ['q1', 'q2'],
      canonical_answer: 'v_ test 2',
      status: 'yes',
      ngo_framing: null,
      evidence: [],
      notes_for_sales: null,
      updated_by: 'test',
    });

    const versions = await listKbVersions(kbId);
    expect(versions.length).toBe(2);
    expect(versions[0].canonical_answer).toBe('v_ test 2');
    expect(versions[1].canonical_answer).toBe('v_ test 1');

    const v = await getKbVersion(versions[1].id);
    expect(v?.canonical_answer).toBe('v_ test 1');
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- tests/lib/db/kb-versions.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

Create `lib/db/queries/kb-versions.ts`:

```typescript
import { query } from '@/lib/db/client';

export interface KbVersionInput {
  category: string;
  question_variants: string[];
  canonical_answer: string;
  status: string | null;
  ngo_framing: string | null;
  evidence: string[];
  notes_for_sales: string | null;
  updated_by: string;
}

export interface KbVersionRow extends KbVersionInput {
  id: number;
  kb_id: string;
  updated_at: Date;
}

export async function insertKbVersion(kbId: string, input: KbVersionInput): Promise<void> {
  await query(
    `INSERT INTO dalgo_kb_versions
       (kb_id, category, question_variants, canonical_answer, status,
        ngo_framing, evidence, notes_for_sales, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      kbId, input.category, input.question_variants, input.canonical_answer,
      input.status, input.ngo_framing, input.evidence, input.notes_for_sales,
      input.updated_by,
    ],
  );
}

export async function listKbVersions(kbId: string): Promise<KbVersionRow[]> {
  const { rows } = await query<KbVersionRow>(
    `SELECT * FROM dalgo_kb_versions
      WHERE kb_id = $1
      ORDER BY updated_at DESC, id DESC`,
    [kbId],
  );
  return rows;
}

export async function getKbVersion(versionId: number): Promise<KbVersionRow | null> {
  const { rows } = await query<KbVersionRow>(
    `SELECT * FROM dalgo_kb_versions WHERE id = $1`,
    [versionId],
  );
  return rows[0] ?? null;
}
```

- [ ] **Step 4: Confirm pass; commit**

Run: `npm test -- tests/lib/db/kb-versions.test.ts`
Expected: PASS.

```bash
git add lib/db/queries/kb-versions.ts tests/lib/db/kb-versions.test.ts
git commit -m "feat(kb): queries for KB version snapshots"
```

---

## Task 3: Modify the existing PATCH route to write a version snapshot

**Files:**
- Modify: `app/api/admin/kb/[id]/route.ts`
- Test: `tests/api/admin/kb-patch-versioning.test.ts`

The current PATCH detects changes to `question_variants` or `canonical_answer` and re-embeds. We add: in the same transaction, insert a snapshot of the **previous** state into `dalgo_kb_versions`. This way the version history captures what the row used to be, not what it just became.

- [ ] **Step 1: Write the failing test**

Create `tests/api/admin/kb-patch-versioning.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { listKbVersions } from '@/lib/db/queries/kb-versions';
import { PATCH } from '@/app/api/admin/kb/[id]/route';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com', isSystem: false } }),
}));

async function createKb(): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO dalgo_knowledge_base
       (category, question_variants, canonical_answer, status, source)
     VALUES ('data_sources', ARRAY['orig q'], 'orig answer', 'yes', 'admin_manual')
     RETURNING id`,
  );
  return rows[0].id;
}

describe('PATCH /api/admin/kb/[id] writes version snapshot', () => {
  let kbId: string;
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_knowledge_base WHERE canonical_answer LIKE 'orig answer%' OR canonical_answer LIKE 'new answer%'`);
    kbId = await createKb();
  });

  it('inserts a version row capturing the prior state on PATCH', async () => {
    const req = new Request(`http://localhost/api/admin/kb/${kbId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ canonical_answer: 'new answer' }),
    });
    const res = await PATCH(req as unknown as Request, { params: Promise.resolve({ id: kbId }) });
    expect(res.status).toBe(200);

    const versions = await listKbVersions(kbId);
    expect(versions.length).toBe(1);
    expect(versions[0].canonical_answer).toBe('orig answer'); // captured the pre-PATCH state
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- tests/api/admin/kb-patch-versioning.test.ts`
Expected: FAIL — no version row gets inserted today.

- [ ] **Step 3: Read the current PATCH handler**

Open `app/api/admin/kb/[id]/route.ts`. Note:
- The current handler reads the existing row, applies the patch, optionally re-embeds, and updates.
- We need to wrap the read + version-insert + update in a single transaction, using `withClient` from `@/lib/db/client`.

- [ ] **Step 4: Modify the PATCH handler**

Update the PATCH handler in `app/api/admin/kb/[id]/route.ts` to use a transaction that captures the prior row:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { withClient } from '@/lib/db/client';
import { embed } from '@/lib/embeddings';

interface Ctx { params: Promise<{ id: string }>; }

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const patch = await req.json();
  const updatedBy = session.user.email ?? 'admin';

  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const cur = await client.query<{
        category: string; question_variants: string[]; canonical_answer: string;
        status: string | null; ngo_framing: string | null; evidence: string[] | null;
        notes_for_sales: string | null;
      }>(
        `SELECT category, question_variants, canonical_answer, status,
                ngo_framing, evidence, notes_for_sales
           FROM dalgo_knowledge_base
          WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (cur.rows.length === 0) throw new Error('not found');
      const prev = cur.rows[0];

      // 1. Snapshot the prior state into dalgo_kb_versions
      await client.query(
        `INSERT INTO dalgo_kb_versions
           (kb_id, category, question_variants, canonical_answer, status,
            ngo_framing, evidence, notes_for_sales, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          id, prev.category, prev.question_variants, prev.canonical_answer,
          prev.status, prev.ngo_framing, prev.evidence ?? [], prev.notes_for_sales,
          updatedBy,
        ],
      );

      // 2. Compute next values
      const next = {
        category: patch.category ?? prev.category,
        question_variants: patch.question_variants ?? prev.question_variants,
        canonical_answer: patch.canonical_answer ?? prev.canonical_answer,
        status: patch.status ?? prev.status,
        ngo_framing: patch.ngo_framing !== undefined ? patch.ngo_framing : prev.ngo_framing,
        evidence: patch.evidence ?? prev.evidence ?? [],
        notes_for_sales: patch.notes_for_sales !== undefined ? patch.notes_for_sales : prev.notes_for_sales,
      };

      // 3. Re-embed if the searchable text changed
      const textChanged =
        patch.question_variants !== undefined || patch.canonical_answer !== undefined;
      let embedding: number[] | null = null;
      if (textChanged) {
        const fullText = `${next.question_variants.join(' | ')}\n${next.canonical_answer}`;
        embedding = await embed(fullText);
      }

      // 4. Update the row
      if (embedding) {
        await client.query(
          `UPDATE dalgo_knowledge_base
              SET category = $2, question_variants = $3, canonical_answer = $4,
                  status = $5, ngo_framing = $6, evidence = $7,
                  notes_for_sales = $8, embedding = $9::vector, updated_at = NOW(),
                  author_email = $10
            WHERE id = $1`,
          [
            id, next.category, next.question_variants, next.canonical_answer,
            next.status, next.ngo_framing, next.evidence, next.notes_for_sales,
            `[${embedding.join(',')}]`, updatedBy,
          ],
        );
      } else {
        await client.query(
          `UPDATE dalgo_knowledge_base
              SET category = $2, question_variants = $3, canonical_answer = $4,
                  status = $5, ngo_framing = $6, evidence = $7,
                  notes_for_sales = $8, updated_at = NOW(), author_email = $9
            WHERE id = $1`,
          [
            id, next.category, next.question_variants, next.canonical_answer,
            next.status, next.ngo_framing, next.evidence, next.notes_for_sales,
            updatedBy,
          ],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });

  return NextResponse.json({ ok: true });
}
```

(Adapt the column list above to match whatever your existing PATCH handler covers — e.g. if it also writes `last_verified`, include that. Read your existing handler carefully before pasting.)

- [ ] **Step 5: Run the test to confirm pass**

Run: `npm test -- tests/api/admin/kb-patch-versioning.test.ts`
Expected: PASS.

Also run any existing KB API tests to make sure they didn't regress:

Run: `npm test -- tests/api/admin/kb`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/kb/[id]/route.ts tests/api/admin/kb-patch-versioning.test.ts
git commit -m "feat(kb): write version snapshot on every PATCH"
```

---

## Task 4: GET versions + POST restore

**Files:**
- Create: `app/api/admin/kb/[id]/versions/route.ts`
- Create: `app/api/admin/kb/[id]/versions/[versionId]/restore/route.ts`
- Test: `tests/api/admin/kb-versions-api.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/admin/kb-versions-api.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { insertKbVersion } from '@/lib/db/queries/kb-versions';
import { GET } from '@/app/api/admin/kb/[id]/versions/route';
import { POST as RESTORE_POST } from '@/app/api/admin/kb/[id]/versions/[versionId]/restore/route';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com' } }),
}));

async function createKb(): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO dalgo_knowledge_base
       (category, question_variants, canonical_answer, status, source)
     VALUES ('data_sources', ARRAY['cur q'], 'current answer', 'yes', 'admin_manual')
     RETURNING id`,
  );
  return rows[0].id;
}

describe('versions API', () => {
  let kbId: string;
  let versionId: number;
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_knowledge_base WHERE canonical_answer LIKE 'current%' OR canonical_answer LIKE 'old%' OR canonical_answer LIKE 'restored%'`);
    kbId = await createKb();
    await insertKbVersion(kbId, {
      category: 'data_sources',
      question_variants: ['old q'],
      canonical_answer: 'old answer',
      status: 'yes',
      ngo_framing: null,
      evidence: [],
      notes_for_sales: null,
      updated_by: 'seed',
    });
    const { rows } = await query<{ id: number }>(
      `SELECT id FROM dalgo_kb_versions WHERE kb_id = $1 ORDER BY id DESC LIMIT 1`,
      [kbId],
    );
    versionId = rows[0].id;
  });

  it('GET versions returns history', async () => {
    const req = new Request(`http://localhost/api/admin/kb/${kbId}/versions`);
    const res = await GET(req as unknown as Request, { params: Promise.resolve({ id: kbId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versions.length).toBeGreaterThanOrEqual(1);
    expect(body.versions[0].canonical_answer).toBe('old answer');
  });

  it('POST restore copies version onto current row + re-embeds', async () => {
    const req = new Request(
      `http://localhost/api/admin/kb/${kbId}/versions/${versionId}/restore`,
      { method: 'POST' },
    );
    const res = await RESTORE_POST(req as unknown as Request, {
      params: Promise.resolve({ id: kbId, versionId: String(versionId) }),
    });
    expect(res.status).toBe(200);
    const { rows } = await query<{ canonical_answer: string; embedding: unknown }>(
      `SELECT canonical_answer, embedding FROM dalgo_knowledge_base WHERE id = $1`,
      [kbId],
    );
    expect(rows[0].canonical_answer).toBe('old answer');
    expect(rows[0].embedding).toBeTruthy();
  }, 30_000);

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- tests/api/admin/kb-versions-api.test.ts`
Expected: FAIL — routes missing.

- [ ] **Step 3: Implement versions GET route**

Create `app/api/admin/kb/[id]/versions/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listKbVersions } from '@/lib/db/queries/kb-versions';

interface Ctx { params: Promise<{ id: string }>; }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const versions = await listKbVersions(id);
  return NextResponse.json({ versions });
}
```

- [ ] **Step 4: Implement restore POST route**

Create `app/api/admin/kb/[id]/versions/[versionId]/restore/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { withClient } from '@/lib/db/client';
import { embed } from '@/lib/embeddings';
import { getKbVersion } from '@/lib/db/queries/kb-versions';

interface Ctx { params: Promise<{ id: string; versionId: string }>; }

export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id, versionId } = await ctx.params;
  const updatedBy = session.user.email ?? 'admin';

  const version = await getKbVersion(Number(versionId));
  if (!version) return NextResponse.json({ error: 'version not found' }, { status: 404 });
  if (version.kb_id !== id) return NextResponse.json({ error: 'version belongs to different KB entry' }, { status: 400 });

  const fullText = `${version.question_variants.join(' | ')}\n${version.canonical_answer}`;
  const embedding = await embed(fullText);

  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      // Snapshot CURRENT state before overwriting (so we can re-restore later)
      const cur = await client.query<{
        category: string; question_variants: string[]; canonical_answer: string;
        status: string | null; ngo_framing: string | null; evidence: string[] | null;
        notes_for_sales: string | null;
      }>(
        `SELECT category, question_variants, canonical_answer, status,
                ngo_framing, evidence, notes_for_sales
           FROM dalgo_knowledge_base WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (cur.rows.length === 0) throw new Error('not found');
      const prev = cur.rows[0];

      await client.query(
        `INSERT INTO dalgo_kb_versions
           (kb_id, category, question_variants, canonical_answer, status,
            ngo_framing, evidence, notes_for_sales, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          id, prev.category, prev.question_variants, prev.canonical_answer,
          prev.status, prev.ngo_framing, prev.evidence ?? [], prev.notes_for_sales,
          updatedBy,
        ],
      );

      // Restore the chosen version onto the current row
      await client.query(
        `UPDATE dalgo_knowledge_base
            SET category = $2, question_variants = $3, canonical_answer = $4,
                status = $5, ngo_framing = $6, evidence = $7,
                notes_for_sales = $8, embedding = $9::vector,
                updated_at = NOW(), author_email = $10
          WHERE id = $1`,
        [
          id, version.category, version.question_variants, version.canonical_answer,
          version.status, version.ngo_framing, version.evidence, version.notes_for_sales,
          `[${embedding.join(',')}]`, updatedBy,
        ],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run test to confirm pass**

Run: `npm test -- tests/api/admin/kb-versions-api.test.ts`
Expected: PASS (2 tests). The restore test hits the real embedding API (~$0.0001).

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/kb/[id]/versions/route.ts app/api/admin/kb/[id]/versions/[versionId]/restore/route.ts tests/api/admin/kb-versions-api.test.ts
git commit -m "feat(kb): versions list + one-click restore endpoints"
```

---

## Task 5: Versions panel on the KB edit page

**Files:**
- Create: `components/admin/kb-versions-panel.tsx`
- Modify: `app/admin/kb/[id]/page.tsx`

- [ ] **Step 1: Build the panel**

Create `components/admin/kb-versions-panel.tsx`:

```typescript
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface VersionRow {
  id: number;
  canonical_answer: string;
  question_variants: string[];
  updated_at: string;
  updated_by: string;
}

export function KbVersionsPanel({ kbId }: { kbId: string }) {
  const router = useRouter();
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/admin/kb/${kbId}/versions`)
      .then((r) => r.json())
      .then((data) => setVersions(data.versions ?? []))
      .finally(() => setLoading(false));
  }, [kbId]);

  async function restore(versionId: number) {
    if (!confirm('Restore this version onto the current entry? Embedding will be regenerated.')) return;
    setRestoring(versionId);
    const res = await fetch(`/api/admin/kb/${kbId}/versions/${versionId}/restore`, { method: 'POST' });
    setRestoring(null);
    if (res.ok) router.refresh();
    else alert(`Restore failed: HTTP ${res.status}`);
  }

  if (loading) return <p className="text-sm text-gray-500">Loading versions…</p>;
  if (versions.length === 0) return <p className="text-sm text-gray-500">No prior versions yet.</p>;

  return (
    <ul className="space-y-2 text-sm">
      {versions.map((v) => (
        <li key={v.id} className="border rounded p-3 flex justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">
              {new Date(v.updated_at).toLocaleString()} by {v.updated_by}
            </div>
            <div className="font-medium">{v.question_variants[0] ?? '(no question)'}</div>
            <div className="text-gray-600 mt-1">{v.canonical_answer.slice(0, 240)}…</div>
          </div>
          <div>
            <button
              onClick={() => restore(v.id)}
              disabled={restoring !== null}
              className="border border-blue-600 text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-50 disabled:opacity-50"
            >
              {restoring === v.id ? 'Restoring…' : 'Restore'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Add the panel to the KB edit page**

Modify `app/admin/kb/[id]/page.tsx`. Below the existing editor (probably `<KbEditor ... />`), add a Version history section:

```typescript
import { KbVersionsPanel } from '@/components/admin/kb-versions-panel';
// ...
<section className="mt-12">
  <h2 className="text-lg font-semibold mb-3">Version history</h2>
  <KbVersionsPanel kbId={id} />
</section>
```

(Use whichever variable holds the KB entry's id in that page — likely `id` from params, or `entry.id`.)

- [ ] **Step 3: Smoke test in browser**

Open any KB entry. Make an edit, save. Reload. Version history shows the prior content. Click "Restore." Confirm. Page refreshes — content is back to the older version.

- [ ] **Step 4: Commit**

```bash
git add components/admin/kb-versions-panel.tsx app/admin/kb/[id]/page.tsx
git commit -m "feat(kb): version history panel with restore button on edit page"
```

---

## Task 6: LLM helper — extract Q&A from pasted text

**Files:**
- Create: `lib/llm/extract-qa.ts`
- Test: `tests/lib/llm/extract-qa.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/llm/extract-qa.test.ts`:

```typescript
import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { pool } from '@/lib/db/client';
import { extractQaPairs } from '@/lib/llm/extract-qa';

describe('extractQaPairs', () => {
  it('extracts at least one Q&A pair from short factual text', async () => {
    const result = await extractQaPairs(
      'Dalgo is a data platform for NGOs. It is free for verified nonprofits and supports common sources like Google Sheets, Airtable, and PostgreSQL.',
      { category: 'pricing' },
    );
    expect(result.pairs.length).toBeGreaterThanOrEqual(1);
    expect(result.pairs[0].question).toBeTruthy();
    expect(result.pairs[0].answer).toBeTruthy();
    expect(Array.isArray(result.pairs[0].variants)).toBe(true);
  }, 30_000);

  it('returns an empty array on garbage input rather than hallucinating', async () => {
    const result = await extractQaPairs('asdkjf asldfkj asldkfj', { category: 'pricing' });
    // Acceptable: 0 pairs or pairs flagged with a confidence < threshold.
    expect(Array.isArray(result.pairs)).toBe(true);
  }, 30_000);

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm test -- tests/lib/llm/extract-qa.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the helper**

Create `lib/llm/extract-qa.ts`:

```typescript
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export interface QaPair {
  question: string;
  variants: string[];
  answer: string;
  status: 'yes' | 'partial' | 'no' | 'roadmap';
  evidence: string[];
}

export interface ExtractOpts {
  category?: string;
}

export async function extractQaPairs(text: string, opts: ExtractOpts = {}): Promise<{ pairs: QaPair[] }> {
  const trimmed = text.trim();
  if (trimmed.length < 30) return { pairs: [] };

  const prompt = `You are organizing knowledge for a chatbot that helps NGO leaders evaluate Dalgo.

Extract self-contained Q&A entries from the SOURCE TEXT below. NGO leaders might naturally ask each question. Each answer must be ONLY from the source — do not invent facts.

For each entry, return:
- question: the canonical phrasing (most natural single question)
- variants: 2-4 alternative phrasings users might use
- answer: the answer written in the bot's voice (warm, professional, concise)
- status: "yes" if Dalgo supports it, "no" if it explicitly doesn't, "partial" for partial support, "roadmap" if planned
- evidence: any URLs from the source that support this entry (can be empty)

Return JSON in this exact shape:
{ "pairs": [ { "question": "...", "variants": ["..."], "answer": "...", "status": "yes", "evidence": ["https://..."] } ] }

If the source text is vague, garbled, or doesn't contain extractable factual content, return { "pairs": [] }.

Category context: ${opts.category ?? 'general'}

SOURCE TEXT:
"""
${trimmed}
"""

Return ONLY the JSON object, no prose, no markdown fences.`;

  const { text: response } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    prompt,
    maxTokens: 4000,
  });

  // Strip markdown fences if the model added them despite instructions
  const cleaned = response
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as { pairs?: QaPair[] };
    if (!Array.isArray(parsed.pairs)) return { pairs: [] };
    // Sanity filter — drop entries missing core fields
    const pairs = parsed.pairs.filter(
      (p) =>
        typeof p.question === 'string' && p.question.length > 0 &&
        typeof p.answer === 'string' && p.answer.length > 0,
    );
    return { pairs };
  } catch {
    return { pairs: [] };
  }
}
```

- [ ] **Step 4: Run test to confirm pass**

Run: `npm test -- tests/lib/llm/extract-qa.test.ts`
Expected: PASS (2 tests). Each test costs ~$0.005.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/extract-qa.ts tests/lib/llm/extract-qa.test.ts
git commit -m "feat(kb): Haiku-based Q&A extractor from pasted text"
```

---

## Task 7: API — POST /api/admin/kb/extract-qa

**Files:**
- Create: `app/api/admin/kb/extract-qa/route.ts`
- Test: `tests/api/admin/kb-extract-qa.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/admin/kb-extract-qa.test.ts`:

```typescript
import { describe, it, expect, afterAll, vi } from 'vitest';
import 'dotenv/config';
import { pool } from '@/lib/db/client';
import { POST } from '@/app/api/admin/kb/extract-qa/route';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com' } }),
}));

describe('POST /api/admin/kb/extract-qa', () => {
  it('returns pairs for a valid pasted text', async () => {
    const req = new Request('http://localhost/api/admin/kb/extract-qa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: 'Dalgo is free for verified NGOs. It runs on AWS in Mumbai region.',
        category: 'pricing',
      }),
    });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.pairs)).toBe(true);
    expect(body.pairs.length).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it('400 for missing text', async () => {
    const req = new Request('http://localhost/api/admin/kb/extract-qa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(400);
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Implement**

Create `app/api/admin/kb/extract-qa/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { extractQaPairs } from '@/lib/llm/extract-qa';

interface Body {
  text?: unknown;
  category?: unknown;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Body;
  try { body = (await req.json()) as Body; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  if (typeof body.text !== 'string' || body.text.trim().length === 0)
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  const category = typeof body.category === 'string' ? body.category : undefined;

  try {
    const result = await extractQaPairs(body.text, { category });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Run test, commit**

```bash
npm test -- tests/api/admin/kb-extract-qa.test.ts
git add app/api/admin/kb/extract-qa/route.ts tests/api/admin/kb-extract-qa.test.ts
git commit -m "feat(kb): API endpoint to extract Q&A from pasted text"
```

---

## Task 8: UI — paste-import page

**Files:**
- Create: `app/admin/kb/import/page.tsx`
- Create: `components/admin/kb-import.tsx`

- [ ] **Step 1: Build the import component**

Create `components/admin/kb-import.tsx`:

```typescript
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Proposal {
  question: string;
  variants: string[];
  answer: string;
  status: 'yes' | 'partial' | 'no' | 'roadmap';
  evidence: string[];
  selected: boolean;
}

const CATEGORIES = [
  'data_sources', 'transforms', 'orchestration', 'dashboards', 'pricing',
  'security', 'support', 'deployment', 'governance', 'integrations',
  'use_cases', 'roadmap', 'case_studies', 'misc',
];

export function KbImport() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [category, setCategory] = useState('misc');
  const [extracting, setExtracting] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function extract() {
    setExtracting(true); setError(null); setProposals([]);
    const res = await fetch('/api/admin/kb/extract-qa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, category }),
    });
    setExtracting(false);
    if (!res.ok) { setError(`HTTP ${res.status}`); return; }
    const { pairs } = await res.json();
    setProposals(pairs.map((p: Omit<Proposal, 'selected'>) => ({ ...p, selected: true })));
  }

  function patchProposal(idx: number, patch: Partial<Proposal>) {
    setProposals((curr) => curr.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function discardProposal(idx: number) {
    setProposals((curr) => curr.filter((_, i) => i !== idx));
  }

  async function saveAll() {
    setSaving(true); setError(null);
    const approved = proposals.filter((p) => p.selected);
    let created = 0;
    for (const p of approved) {
      const res = await fetch('/api/admin/kb', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category,
          question_variants: [p.question, ...(p.variants ?? [])],
          canonical_answer: p.answer,
          status: p.status,
          evidence: p.evidence,
        }),
      });
      if (res.ok) created++;
    }
    setSaving(false);
    if (created === 0) { setError('Nothing was created.'); return; }
    router.push('/admin/kb');
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <section>
        <h2 className="text-lg font-semibold mb-2">1. Paste source content</h2>
        <label className="block mb-2">
          <span className="text-sm font-medium">Category</span>
          <select className="border rounded p-2 ml-2" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <textarea
          className="w-full min-h-[180px] border rounded p-3 font-mono text-sm"
          placeholder="Paste short factual content or a longer doc section (~200-1500 words)…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={extract}
          disabled={extracting || text.trim().length < 30}
          className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {extracting ? 'Extracting Q&A…' : 'Suggest Q&A entries'}
        </button>
      </section>

      {error && <p className="text-red-600">Error: {error}</p>}

      {proposals.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">2. Review proposed entries ({proposals.length})</h2>
          <div className="space-y-4">
            {proposals.map((p, idx) => (
              <div key={idx} className={`border rounded p-4 ${p.selected ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                <label className="flex gap-2 items-start mb-2">
                  <input
                    type="checkbox"
                    checked={p.selected}
                    onChange={(e) => patchProposal(idx, { selected: e.target.checked })}
                    className="mt-1"
                  />
                  <input
                    className="flex-1 border rounded p-2 font-semibold"
                    value={p.question}
                    onChange={(e) => patchProposal(idx, { question: e.target.value })}
                  />
                </label>
                <textarea
                  className="w-full border rounded p-2 mb-2 text-sm"
                  value={p.answer}
                  onChange={(e) => patchProposal(idx, { answer: e.target.value })}
                  rows={3}
                />
                <div className="flex items-center gap-3 text-sm">
                  <label>
                    Status:
                    <select
                      className="border rounded p-1 ml-1"
                      value={p.status}
                      onChange={(e) => patchProposal(idx, { status: e.target.value as Proposal['status'] })}
                    >
                      <option value="yes">yes</option>
                      <option value="partial">partial</option>
                      <option value="no">no</option>
                      <option value="roadmap">roadmap</option>
                    </select>
                  </label>
                  <span className="text-gray-500">Variants: {p.variants.join(', ')}</span>
                  <button
                    onClick={() => discardProposal(idx)}
                    className="ml-auto text-red-600 hover:underline"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={saveAll}
            disabled={saving || proposals.filter((p) => p.selected).length === 0}
            className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : `Save ${proposals.filter((p) => p.selected).length} selected to KB`}
          </button>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build the page**

Create `app/admin/kb/import/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { KbImport } from '@/components/admin/kb-import';

export default async function KbImportPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Import KB content via paste</h1>
      <p className="text-gray-600 text-sm mb-6">
        Paste raw text. We&apos;ll propose Q&amp;A entries — review, edit, and approve
        the ones to add to the knowledge base.
      </p>
      <KbImport />
    </main>
  );
}
```

- [ ] **Step 3: Add link from the KB list page**

Modify `app/admin/kb/page.tsx`. Near the existing "New entry" button, add:

```typescript
<Link href="/admin/kb/import" className="border border-blue-600 text-blue-600 px-4 py-2 rounded hover:bg-blue-50 ml-2">
  Import via paste
</Link>
```

- [ ] **Step 4: Smoke test in browser**

1. `/admin/kb/import` → paste a short fact about Dalgo → click "Suggest Q&A entries"
2. ~5–10s later, see proposed entries
3. Edit a couple, discard one
4. Click "Save selected to KB"
5. Redirected to `/admin/kb` — new entries are present

- [ ] **Step 5: Commit**

```bash
git add components/admin/kb-import.tsx app/admin/kb/import/page.tsx app/admin/kb/page.tsx
git commit -m "feat(kb): paste-to-Q&A import flow at /admin/kb/import"
```

---

## Task 9: Final verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 3: End-to-end smoke**

In the browser:
1. `/admin/kb` — click "Import via paste" → paste content → approve some entries
2. Confirm new entries appear in the list
3. Open an existing entry → make an edit → save
4. Reload — version history section shows the prior state
5. Click "Restore" on the prior version → confirm → page refreshes with old content

If all 5 work, KB enhancements are complete.

- [ ] **Step 4: Final commit if needed**

```bash
git status
# if stray changes:
git add .
git commit -m "chore(kb): cleanup after import + versioning work"
```

---

## Total estimated effort

- **Tasks 1–5 (versioning)**: ~3 hours focused work
- **Tasks 6–8 (paste-import)**: ~3 hours focused work
- **Task 9 (verify)**: ~30 min

Roughly **6–7 hours** end-to-end for a focused implementer who follows the test-first sequence.

The KB enhancements are independent of the eval plans; they can ship in any order. Once all three plans (Plan 1, Plan 2, Plan 3) are merged, the admin panel covers the full building-phase workflow we designed.
