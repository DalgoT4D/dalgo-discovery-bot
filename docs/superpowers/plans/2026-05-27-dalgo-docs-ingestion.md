# Dalgo product-docs corpus ingestion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new docs corpus + retrieval tool so the bot can cite official Dalgo product docs (`https://dalgot4d.github.io/dalgo_docs/`) with section-precise deep links.

**Architecture:** Mirror the existing `lib/blogs/` 8-module pipeline (indexer → fetcher → parser → chunker → contextualizer → upsert → ingest + types) under a new `lib/docs/` directory, with a Docusaurus-specific parser and h2-section-based chunking that preserves `#anchor` deep-link targets. Surface via a new `search_dalgo_docs` tool registered in `buildToolset()`. Two surgical prompt edits land via the existing admin-prompts SQL pattern. A 6-case `docs-citations` eval bucket gates correctness.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest (`environment: node`), raw `pg` Pool + pgvector, OpenAI `text-embedding-3-small` @ 1536 dims, Anthropic Claude Haiku 4.5 for contextualizer, Vercel AI SDK v4 (`tool`, `generateText`), `cheerio` + `turndown` for HTML parsing.

**Spec:** `docs/superpowers/specs/2026-05-27-dalgo-docs-ingestion-design.md`

**Branch:** `feat/blog-ingestion` (continue commits on this long-lived branch; do NOT merge to main or push without explicit user instruction)

**Pre-flight expectations for the implementer:**
- Postgres container `dalgo-discovery-db` is up (`docker compose up -d` if not). Apply migrations with `docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery < <file>`.
- `.env.local` exists with `DATABASE_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, NextAuth credentials. Tests load `.env.local` automatically via vitest's `setupFiles: ['dotenv/config']` and the `DOTENV_CONFIG_PATH` env var.
- Run a single test file: `npm test -- tests/lib/docs/parser.test.ts`
- Run all tests: `npm test` (the LLM-eval suite at `tests/llm/eval.test.ts` times out without API keys — pre-existing per CLAUDE.md)
- **Mirror the blog pipeline exactly where possible** — file names, function signatures, error patterns. Diverge only where Docusaurus markup requires it (parser) or where docs-specific behavior requires it (section anchors in chunker).
- **Do NOT push, do NOT merge to main, do NOT modify any branch other than `feat/blog-ingestion`.**

---

## Task 1: Schema + migration

**Files:**
- Modify: `lib/db/schema.sql` (append Phase 5 block at end)
- Create: `scripts/migrations/003_docs_corpus.sql`
- Create: `tests/lib/db/docs-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Create `tests/lib/db/docs-schema.test.ts`:

```typescript
import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';

describe('dalgo_docs_pages + dalgo_docs_chunks schema', () => {
  it('dalgo_docs_pages table exists with the expected columns and CHECK constraint', async () => {
    const { rows } = await query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type
         FROM information_schema.columns
        WHERE table_name = 'dalgo_docs_pages'
        ORDER BY ordinal_position`,
    );
    const colNames = rows.map((r) => r.column_name);
    expect(colNames).toEqual([
      'id', 'url', 'tree', 'category', 'title', 'description',
      'content_md', 'content_hash', 'last_fetched_at', 'created_at',
    ]);

    // CHECK constraint on tree
    const checks = await query<{ pg_get_constraintdef: string }>(
      `SELECT pg_get_constraintdef(c.oid)
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'dalgo_docs_pages' AND c.contype = 'c'`,
    );
    const checkText = checks.rows.map((r) => r.pg_get_constraintdef).join(' ');
    expect(checkText).toMatch(/tree.*IN.*'docs'.*'resources'/);
  });

  it('dalgo_docs_chunks table exists with FK + vector(1536) + tsv', async () => {
    const { rows } = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'dalgo_docs_chunks'
        ORDER BY ordinal_position`,
    );
    const colNames = rows.map((r) => r.column_name);
    expect(colNames).toEqual([
      'id', 'page_id', 'chunk_index', 'section_anchor', 'section_title',
      'chunk_text', 'contextual_text', 'embedding', 'tsv',
    ]);
  });

  it('CASCADE FK: deleting a page deletes its chunks', async () => {
    // Insert a throwaway page + chunk; delete page; assert chunk gone.
    const pageRes = await query<{ id: string }>(
      `INSERT INTO dalgo_docs_pages (url, tree, category, title, content_md, content_hash)
       VALUES ('http://test.invalid/p1', 'docs', 'test', 'T', 'body', 'h')
       RETURNING id`,
    );
    const pageId = pageRes.rows[0].id;
    await query(
      `INSERT INTO dalgo_docs_chunks
         (page_id, chunk_index, chunk_text, contextual_text, embedding)
       VALUES ($1, 0, 'c', 'ctx',
               (array_fill(0::real, ARRAY[1536]))::vector)`,
      [pageId],
    );
    const before = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM dalgo_docs_chunks WHERE page_id = $1`, [pageId],
    );
    expect(before.rows[0].n).toBe(1);
    await query(`DELETE FROM dalgo_docs_pages WHERE id = $1`, [pageId]);
    const after = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM dalgo_docs_chunks WHERE page_id = $1`, [pageId],
    );
    expect(after.rows[0].n).toBe(0);
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- tests/lib/db/docs-schema.test.ts`
Expected: FAIL with `relation "dalgo_docs_pages" does not exist`.

- [ ] **Step 3: Append schema to `lib/db/schema.sql`**

Append at the very end of the file (after the existing last line):

```sql

-- ============================================================
-- Phase 5: Dalgo product-docs corpus (2026-05-27)
-- Pages from https://dalgot4d.github.io/dalgo_docs/. Two trees:
-- 'docs' (Documentation tab) and 'resources' (Resources tab).
-- See scripts/migrations/003_docs_corpus.sql for migration shape.
-- ============================================================

CREATE TABLE IF NOT EXISTS dalgo_docs_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url             text UNIQUE NOT NULL,
  tree            text NOT NULL CHECK (tree IN ('docs', 'resources')),
  category        text NOT NULL,
  title           text NOT NULL,
  description     text,
  content_md      text NOT NULL,
  content_hash    text NOT NULL,
  last_fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS docs_pages_tree_idx     ON dalgo_docs_pages (tree);
CREATE INDEX IF NOT EXISTS docs_pages_category_idx ON dalgo_docs_pages (category);

CREATE TABLE IF NOT EXISTS dalgo_docs_chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id         uuid NOT NULL REFERENCES dalgo_docs_pages(id) ON DELETE CASCADE,
  chunk_index     int  NOT NULL,
  section_anchor  text,
  section_title   text,
  chunk_text      text NOT NULL,
  contextual_text text NOT NULL,
  embedding       vector(1536) NOT NULL,
  tsv             tsvector GENERATED ALWAYS AS (to_tsvector('english', contextual_text)) STORED,
  UNIQUE (page_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS docs_chunks_embedding_idx ON dalgo_docs_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS docs_chunks_tsv_idx       ON dalgo_docs_chunks USING gin (tsv);
```

- [ ] **Step 4: Create the one-shot migration**

Create `scripts/migrations/003_docs_corpus.sql`:

```sql
-- 003_docs_corpus.sql — dalgo product-docs corpus tables
-- Apply with:
--   docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery \
--     < scripts/migrations/003_docs_corpus.sql
BEGIN;

CREATE TABLE IF NOT EXISTS dalgo_docs_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url             text UNIQUE NOT NULL,
  tree            text NOT NULL CHECK (tree IN ('docs', 'resources')),
  category        text NOT NULL,
  title           text NOT NULL,
  description     text,
  content_md      text NOT NULL,
  content_hash    text NOT NULL,
  last_fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS docs_pages_tree_idx     ON dalgo_docs_pages (tree);
CREATE INDEX IF NOT EXISTS docs_pages_category_idx ON dalgo_docs_pages (category);

CREATE TABLE IF NOT EXISTS dalgo_docs_chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id         uuid NOT NULL REFERENCES dalgo_docs_pages(id) ON DELETE CASCADE,
  chunk_index     int  NOT NULL,
  section_anchor  text,
  section_title   text,
  chunk_text      text NOT NULL,
  contextual_text text NOT NULL,
  embedding       vector(1536) NOT NULL,
  tsv             tsvector GENERATED ALWAYS AS (to_tsvector('english', contextual_text)) STORED,
  UNIQUE (page_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS docs_chunks_embedding_idx ON dalgo_docs_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS docs_chunks_tsv_idx       ON dalgo_docs_chunks USING gin (tsv);

COMMIT;
```

- [ ] **Step 5: Apply the migration**

```bash
docker ps --filter name=dalgo-discovery-db --format '{{.Status}}'
```
Expected: a line starting with `Up`. If empty: `docker compose up -d`.

```bash
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery \
  < scripts/migrations/003_docs_corpus.sql
```
Expected output ends with `COMMIT` and shows 2 `CREATE TABLE` + 4 `CREATE INDEX` lines (idempotent on re-run).

- [ ] **Step 6: Re-run the schema test to verify pass**

Run: `npm test -- tests/lib/db/docs-schema.test.ts`
Expected: PASS, all 3 tests green.

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema.sql scripts/migrations/003_docs_corpus.sql tests/lib/db/docs-schema.test.ts
git commit -m "$(cat <<'EOF'
feat(db): dalgo product-docs corpus schema

Two new tables: dalgo_docs_pages (one row per doc page with tree + category
metadata) and dalgo_docs_chunks (one row per h2 section with section_anchor
preserved for deep-link citations + vector(1536) embedding + tsv for hybrid
search). Mirrors dalgo_blog_articles/chunks pattern with docs-specific
fields. Migration is idempotent (IF NOT EXISTS + BEGIN/COMMIT).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Types + sitemap indexer

**Files:**
- Create: `lib/docs/types.ts`
- Create: `lib/docs/indexer.ts`
- Create: `tests/lib/docs/indexer.test.ts`
- Create: `tests/fixtures/docs/sitemap-mini.xml`

- [ ] **Step 1: Create types**

Create `lib/docs/types.ts`:

```typescript
// lib/docs/types.ts

export type DocTree = 'docs' | 'resources';

export interface DocPageRef {
  url: string;       // canonical absolute URL incl. host
  tree: DocTree;
}

export interface RawDocPage {
  url: string;
  tree: DocTree;
  html: string;
  fetchedAt: Date;
  fromCache: boolean;
}

export interface DocSection {
  anchor: string | null;     // h2 id, null for the intro section before any h2
  title: string | null;      // h2 text, null for intro
  contentMd: string;         // section body as markdown
}

export interface ParsedDocPage {
  url: string;
  tree: DocTree;
  category: string;          // first URL segment after the tree
  title: string;             // h1
  description: string | null;
  contentMd: string;         // whole article body as markdown (for content_hash + storage)
  sections: DocSection[];
}

export interface DocChunk {
  chunkIndex: number;
  sectionAnchor: string | null;
  sectionTitle: string | null;
  chunkText: string;
}

export interface EmbeddedDocChunk extends DocChunk {
  contextualText: string;
  embedding: number[];
}

export interface DocUpsertResult {
  kind: 'new' | 'updated' | 'skipped';
  pageId: string;
  chunkCount: number;
}

export interface DocsJobSummary {
  pagesSeen: number;
  pagesNew: number;
  pagesUpdated: number;
  pagesSkipped: number;
  pagesRemoved: number;
  error?: string;
}
```

- [ ] **Step 2: Create the sitemap fixture**

Create `tests/fixtures/docs/sitemap-mini.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://dalgot4d.github.io/dalgo_docs/</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>
  <url><loc>https://dalgot4d.github.io/dalgo_docs/docs/intro</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>
  <url><loc>https://dalgot4d.github.io/dalgo_docs/docs/charts/</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>
  <url><loc>https://dalgot4d.github.io/dalgo_docs/docs/quickstart/</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>
  <url><loc>https://dalgot4d.github.io/dalgo_docs/self-serve-documentation/intro</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>
  <url><loc>https://dalgot4d.github.io/dalgo_docs/self-serve-documentation/getting-started/</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>
</urlset>
```

- [ ] **Step 3: Write the failing indexer test**

Create `tests/lib/docs/indexer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSitemap } from '@/lib/docs/indexer';

describe('parseSitemap', () => {
  const xml = readFileSync(
    join(__dirname, '../../fixtures/docs/sitemap-mini.xml'),
    'utf8',
  );

  it('returns one DocPageRef per <loc> with tree classified from URL path', () => {
    const refs = parseSitemap(xml);
    expect(refs).toEqual(
      expect.arrayContaining([
        { url: 'https://dalgot4d.github.io/dalgo_docs/docs/intro', tree: 'docs' },
        { url: 'https://dalgot4d.github.io/dalgo_docs/docs/charts/', tree: 'docs' },
        { url: 'https://dalgot4d.github.io/dalgo_docs/docs/quickstart/', tree: 'docs' },
        { url: 'https://dalgot4d.github.io/dalgo_docs/self-serve-documentation/intro', tree: 'resources' },
        { url: 'https://dalgot4d.github.io/dalgo_docs/self-serve-documentation/getting-started/', tree: 'resources' },
      ]),
    );
  });

  it('skips URLs that match neither tree (e.g. the bare root /)', () => {
    const refs = parseSitemap(xml);
    expect(refs.find((r) => r.url.endsWith('/dalgo_docs/'))).toBeUndefined();
  });

  it('dedupes if the sitemap repeats a URL', () => {
    const dup = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://dalgot4d.github.io/dalgo_docs/docs/intro</loc></url>
      <url><loc>https://dalgot4d.github.io/dalgo_docs/docs/intro</loc></url>
    </urlset>`;
    expect(parseSitemap(dup).length).toBe(1);
  });
});
```

- [ ] **Step 4: Run test to confirm fail**

Run: `npm test -- tests/lib/docs/indexer.test.ts`
Expected: FAIL with `Cannot find module '@/lib/docs/indexer'`.

- [ ] **Step 5: Implement the indexer**

Create `lib/docs/indexer.ts`:

```typescript
// lib/docs/indexer.ts
import * as cheerio from 'cheerio';
import type { DocPageRef, DocTree } from './types';

const SITEMAP_URL = 'https://dalgot4d.github.io/dalgo_docs/sitemap.xml';
const UA = 'DalgoDiscoveryBot/1.0 (+https://dalgo.org)';

function classifyTree(url: string): DocTree | null {
  if (url.includes('/dalgo_docs/docs/')) return 'docs';
  if (url.includes('/dalgo_docs/self-serve-documentation/')) return 'resources';
  return null;
}

export function parseSitemap(xml: string): DocPageRef[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const seen = new Set<string>();
  const out: DocPageRef[] = [];
  $('url > loc').each((_, el) => {
    const url = $(el).text().trim();
    if (!url || seen.has(url)) return;
    const tree = classifyTree(url);
    if (!tree) return;
    seen.add(url);
    out.push({ url, tree });
  });
  return out;
}

export interface FetchSitemapOpts {
  fetchFn?: typeof fetch;
  sitemapUrl?: string;
}

export async function fetchSitemap(opts: FetchSitemapOpts = {}): Promise<DocPageRef[]> {
  const fetchFn = opts.fetchFn ?? fetch;
  const url = opts.sitemapUrl ?? SITEMAP_URL;
  const res = await fetchFn(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`fetchSitemap ${url} failed: HTTP ${res.status}`);
  const xml = await res.text();
  return parseSitemap(xml);
}
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npm test -- tests/lib/docs/indexer.test.ts`
Expected: PASS, all 3 tests green.

- [ ] **Step 7: Commit**

```bash
git add lib/docs/types.ts lib/docs/indexer.ts tests/lib/docs/indexer.test.ts tests/fixtures/docs/sitemap-mini.xml
git commit -m "$(cat <<'EOF'
feat(docs): types + sitemap indexer

Walks dalgot4d.github.io/dalgo_docs/sitemap.xml, classifies each <loc>
into docs / resources tree based on URL path, returns DocPageRef[].

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Page fetcher (24h on-disk cache)

**Files:**
- Create: `lib/docs/fetcher.ts`
- Create: `tests/lib/docs/fetcher.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/docs/fetcher.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fetchDocPage } from '@/lib/docs/fetcher';

function makeMockFetch(html: string) {
  return async () => ({
    ok: true,
    status: 200,
    text: async () => html,
  } as Response);
}

describe('fetchDocPage', () => {
  let cacheDir: string;
  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), 'docs-fetcher-'));
  });

  it('fetches and caches on first call', async () => {
    const page = await fetchDocPage(
      { url: 'http://test.invalid/p1', tree: 'docs' },
      { cacheDir, fetchFn: makeMockFetch('<html>HI</html>') },
    );
    expect(page.html).toBe('<html>HI</html>');
    expect(page.fromCache).toBe(false);
    expect(page.tree).toBe('docs');

    const key = createHash('sha1').update('http://test.invalid/p1').digest('hex') + '.html';
    expect(existsSync(join(cacheDir, key))).toBe(true);
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it('returns cached html on subsequent calls', async () => {
    const key = createHash('sha1').update('http://test.invalid/p2').digest('hex') + '.html';
    writeFileSync(join(cacheDir, key), '<html>CACHED</html>', 'utf8');

    let called = 0;
    const fetchFn = async () => { called++; return { ok: true, status: 200, text: async () => 'should-not-be-used' } as Response; };
    const page = await fetchDocPage(
      { url: 'http://test.invalid/p2', tree: 'docs' },
      { cacheDir, fetchFn },
    );
    expect(page.html).toBe('<html>CACHED</html>');
    expect(page.fromCache).toBe(true);
    expect(called).toBe(0);
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it('throws on non-2xx response', async () => {
    const fetchFn = async () => ({ ok: false, status: 503, text: async () => '' } as Response);
    await expect(
      fetchDocPage({ url: 'http://test.invalid/p3', tree: 'docs' }, { cacheDir, fetchFn }),
    ).rejects.toThrow(/HTTP 503/);
    rmSync(cacheDir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to confirm fail**

Run: `npm test -- tests/lib/docs/fetcher.test.ts`
Expected: FAIL with `Cannot find module '@/lib/docs/fetcher'`.

- [ ] **Step 3: Implement the fetcher**

Create `lib/docs/fetcher.ts`:

```typescript
// lib/docs/fetcher.ts
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DocPageRef, RawDocPage } from './types';

const UA = 'DalgoDiscoveryBot/1.0 (+https://dalgo.org)';
const DEFAULT_CACHE_DIR = '.cache/docs';

export interface DocFetchOpts {
  cacheDir?: string;
  fetchFn?: typeof fetch;
  force?: boolean;        // ignore cache; always fetch fresh
}

function cacheKey(url: string): string {
  return createHash('sha1').update(url).digest('hex') + '.html';
}

export async function fetchDocPage(
  ref: DocPageRef,
  opts: DocFetchOpts = {},
): Promise<RawDocPage> {
  const cacheDir = opts.cacheDir ?? DEFAULT_CACHE_DIR;
  const fetchFn = opts.fetchFn ?? fetch;
  mkdirSync(cacheDir, { recursive: true });
  const cachePath = join(cacheDir, cacheKey(ref.url));

  if (!opts.force && existsSync(cachePath)) {
    return {
      url: ref.url,
      tree: ref.tree,
      html: readFileSync(cachePath, 'utf8'),
      fetchedAt: new Date(),
      fromCache: true,
    };
  }

  const res = await fetchFn(ref.url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Fetch ${ref.url} failed: HTTP ${res.status}`);
  const html = await res.text();
  writeFileSync(cachePath, html, 'utf8');
  return { url: ref.url, tree: ref.tree, html, fetchedAt: new Date(), fromCache: false };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/lib/docs/fetcher.test.ts`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/docs/fetcher.ts tests/lib/docs/fetcher.test.ts
git commit -m "$(cat <<'EOF'
feat(docs): page fetcher with on-disk cache

Mirrors lib/blogs/fetcher.ts shape. Cache dir defaults to .cache/docs/,
key = sha1(url) + .html. --force flag bypasses cache.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Parser (Docusaurus HTML → ParsedDocPage)

**Files:**
- Create: `lib/docs/parser.ts`
- Create: `tests/lib/docs/parser.test.ts`
- Create: `tests/fixtures/docs/intro-page.html` (real fixture captured from live site)

- [ ] **Step 1: Capture a real fixture from the live docs site**

Run from project root:

```bash
mkdir -p tests/fixtures/docs
curl -sL https://dalgot4d.github.io/dalgo_docs/docs/intro > tests/fixtures/docs/intro-page.html
ls -la tests/fixtures/docs/intro-page.html
```

Expected: file ~10-30 KB. If empty or 404, the docs site URL has changed — investigate before proceeding.

- [ ] **Step 2: Write the failing parser test**

Create `tests/lib/docs/parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocPage } from '@/lib/docs/parser';
import type { RawDocPage } from '@/lib/docs/types';

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, '../../fixtures/docs', name), 'utf8');
}

function rawPage(html: string, url = 'https://dalgot4d.github.io/dalgo_docs/docs/intro'): RawDocPage {
  return { url, tree: 'docs', html, fetchedAt: new Date(), fromCache: false };
}

describe('parseDocPage (intro page)', () => {
  const html = loadFixture('intro-page.html');
  const parsed = parseDocPage(rawPage(html));

  it('extracts the h1 as title', () => {
    expect(parsed.title).toMatch(/Welcome to Dalgo/i);
  });

  it('extracts category from the URL path segment after the tree', () => {
    expect(parsed.category).toBe('intro');
  });

  it('captures the page tree from the input ref', () => {
    expect(parsed.tree).toBe('docs');
  });

  it('produces a non-empty markdown body', () => {
    expect(parsed.contentMd.length).toBeGreaterThan(200);
    expect(parsed.contentMd).toMatch(/Dalgo/);
  });

  it('extracts a description (og:description or first paragraph)', () => {
    expect(parsed.description).toBeTruthy();
    expect(parsed.description!.length).toBeGreaterThan(20);
  });

  it('produces an intro section (anchor null, title null) for content before the first h2', () => {
    const intro = parsed.sections.find((s) => s.anchor === null);
    expect(intro).toBeTruthy();
    expect(intro!.contentMd.length).toBeGreaterThan(0);
  });

  it('produces at least one named section with anchor + title', () => {
    const named = parsed.sections.filter((s) => s.anchor !== null);
    expect(named.length).toBeGreaterThan(0);
    expect(named[0].anchor).toMatch(/^[a-z0-9-]+$/);
    expect(named[0].title!.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test to confirm fail**

Run: `npm test -- tests/lib/docs/parser.test.ts`
Expected: FAIL with `Cannot find module '@/lib/docs/parser'`.

- [ ] **Step 4: Implement the parser**

Create `lib/docs/parser.ts`:

```typescript
// lib/docs/parser.ts
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import type { DocSection, ParsedDocPage, RawDocPage } from './types';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});
turndown.remove(['script', 'style', 'noscript', 'iframe']);

// Docusaurus 3.x article body selector. The class is stable across versions.
const ARTICLE_SELECTOR = 'article .theme-doc-markdown';

function extractCategoryFromUrl(url: string, tree: string): string {
  // tree-aware: after /docs/ or /self-serve-documentation/, take the next non-empty segment.
  const treeSegment = tree === 'docs' ? '/docs/' : '/self-serve-documentation/';
  const idx = url.indexOf(treeSegment);
  if (idx === -1) return 'unknown';
  const after = url.slice(idx + treeSegment.length);
  const seg = after.split('/').filter(Boolean)[0];
  return seg || 'intro';
}

function extractDescription($: cheerio.CheerioAPI): string | null {
  const og = $('meta[name="description"]').attr('content');
  if (og && og.trim()) return og.trim();
  const firstP = $(ARTICLE_SELECTOR).find('p').first().text().trim();
  return firstP || null;
}

function splitSections(
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $article: cheerio.Cheerio<any>,
): DocSection[] {
  // Walk the article children in order. Each h2 starts a new section.
  // Pre-h2 content is the "intro" section (anchor = null, title = null).
  const sections: DocSection[] = [];
  let currentAnchor: string | null = null;
  let currentTitle: string | null = null;
  let currentHtmlParts: string[] = [];

  const flush = () => {
    const html = currentHtmlParts.join('\n').trim();
    if (!html) return;
    const md = turndown.turndown(html).trim();
    if (!md) return;
    sections.push({ anchor: currentAnchor, title: currentTitle, contentMd: md });
  };

  $article.children().each((_, el) => {
    const $el = $(el);
    if ($el.is('h2')) {
      flush();
      currentAnchor = $el.attr('id') ?? null;
      currentTitle = $el.text().replace(/\s+/g, ' ').trim().replace(/​$/, '');
      currentHtmlParts = [];
      return;
    }
    currentHtmlParts.push($.html($el));
  });
  flush();
  return sections;
}

export function parseDocPage(raw: RawDocPage): ParsedDocPage {
  const $ = cheerio.load(raw.html);
  const $article = $(ARTICLE_SELECTOR).first();
  if (!$article.length) {
    throw new Error(`parseDocPage: no <article> body found at ${raw.url}`);
  }
  const title = $article.find('h1').first().text().trim();
  if (!title) throw new Error(`parseDocPage: no h1 found at ${raw.url}`);

  const description = extractDescription($);
  const contentMd = turndown.turndown($article.html() ?? '').trim();
  const sections = splitSections($, $article);
  const category = extractCategoryFromUrl(raw.url, raw.tree);

  return {
    url: raw.url,
    tree: raw.tree,
    category,
    title,
    description,
    contentMd,
    sections,
  };
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm test -- tests/lib/docs/parser.test.ts`
Expected: PASS, all 7 tests green. If any fail, the Docusaurus markup may differ from the recon — inspect `tests/fixtures/docs/intro-page.html` directly and adjust selectors in `lib/docs/parser.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/docs/parser.ts tests/lib/docs/parser.test.ts tests/fixtures/docs/intro-page.html
git commit -m "$(cat <<'EOF'
feat(docs): Docusaurus HTML parser

Extracts title (h1), description (meta or first p), category (URL path
segment), full-page markdown, and per-h2 sections with anchor + title
preserved for deep-link citations. Uses cheerio + turndown (same deps
as the blog parser).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Chunker + contextualizer

**Files:**
- Create: `lib/docs/chunker.ts`
- Create: `lib/docs/contextualizer.ts`
- Create: `tests/lib/docs/chunker.test.ts`

The chunker is trivial: one chunk per `ParsedDocPage.section`. The contextualizer mirrors `lib/blogs/contextualizer.ts` with a docs-specific prompt and DI for tests.

- [ ] **Step 1: Write the failing chunker test**

Create `tests/lib/docs/chunker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { chunkDocPage } from '@/lib/docs/chunker';
import type { ParsedDocPage } from '@/lib/docs/types';

function fixture(): ParsedDocPage {
  return {
    url: 'http://test/x',
    tree: 'docs',
    category: 'x',
    title: 'X',
    description: 'd',
    contentMd: 'whole body',
    sections: [
      { anchor: null,           title: null,           contentMd: 'Intro text.' },
      { anchor: 'first-thing',  title: 'First Thing',  contentMd: 'First body.' },
      { anchor: 'second-thing', title: 'Second Thing', contentMd: 'Second body.' },
    ],
  };
}

describe('chunkDocPage', () => {
  it('returns one chunk per section', () => {
    const chunks = chunkDocPage(fixture());
    expect(chunks.length).toBe(3);
  });

  it('assigns chunk_index in section order', () => {
    const chunks = chunkDocPage(fixture());
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1, 2]);
  });

  it('preserves section_anchor + section_title (null for intro)', () => {
    const chunks = chunkDocPage(fixture());
    expect(chunks[0].sectionAnchor).toBeNull();
    expect(chunks[0].sectionTitle).toBeNull();
    expect(chunks[1].sectionAnchor).toBe('first-thing');
    expect(chunks[1].sectionTitle).toBe('First Thing');
  });

  it('skips sections whose content is empty after trim', () => {
    const empty = fixture();
    empty.sections.push({ anchor: 'blank', title: 'Blank', contentMd: '   ' });
    const chunks = chunkDocPage(empty);
    expect(chunks.length).toBe(3); // empty section dropped
  });
});
```

- [ ] **Step 2: Run test to confirm fail**

Run: `npm test -- tests/lib/docs/chunker.test.ts`
Expected: FAIL with `Cannot find module '@/lib/docs/chunker'`.

- [ ] **Step 3: Implement the chunker**

Create `lib/docs/chunker.ts`:

```typescript
// lib/docs/chunker.ts
import type { DocChunk, ParsedDocPage } from './types';

export function chunkDocPage(page: ParsedDocPage): DocChunk[] {
  const out: DocChunk[] = [];
  let idx = 0;
  for (const s of page.sections) {
    const text = s.contentMd.trim();
    if (!text) continue;
    out.push({
      chunkIndex: idx++,
      sectionAnchor: s.anchor,
      sectionTitle: s.title,
      chunkText: text,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run chunker test to verify pass**

Run: `npm test -- tests/lib/docs/chunker.test.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Implement the contextualizer**

Create `lib/docs/contextualizer.ts`:

```typescript
// lib/docs/contextualizer.ts
import { generateText } from 'ai';
import { anthropic } from '@/lib/llm/client';
import type { DocChunk, ParsedDocPage } from './types';

export interface DocContextualizerDeps {
  generate?: (prompt: string) => Promise<string>;
}

// Cheap, fast model for bulk per-chunk summarization.
const CONTEXTUALIZER_MODEL = 'claude-haiku-4-5-20251001';

const PROMPT_TEMPLATE = (page: ParsedDocPage, chunk: DocChunk) => `
You are summarizing a section of the official Dalgo product documentation for a search index.
Write ONE short sentence (max 25 words) that helps a search engine locate this chunk. Mention:
- which page / topic this chunk belongs to,
- what specific procedure or concept it covers.
No marketing fluff. Plain declarative sentence ending with a period.

PAGE TITLE: ${page.title}
PAGE CATEGORY: ${page.category}
SECTION: ${chunk.sectionTitle ?? '(intro)'}

CHUNK CONTENT (first 1200 chars):
${chunk.chunkText.slice(0, 1200)}

Return ONLY the sentence, nothing else.
`.trim();

async function defaultGenerate(prompt: string): Promise<string> {
  const { text } = await generateText({
    model: anthropic(CONTEXTUALIZER_MODEL),
    prompt,
    maxTokens: 80,
  });
  return text;
}

export async function generateChunkContext(
  page: ParsedDocPage,
  chunk: DocChunk,
  deps: DocContextualizerDeps = {},
): Promise<string> {
  const generate = deps.generate ?? defaultGenerate;
  const raw = await generate(PROMPT_TEMPLATE(page, chunk));
  return raw.trim();
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/docs/chunker.ts lib/docs/contextualizer.ts tests/lib/docs/chunker.test.ts
git commit -m "$(cat <<'EOF'
feat(docs): chunker + contextualizer

Chunker: one DocChunk per parsed section, intro chunk has null anchor.
Contextualizer: per-chunk 25-word Claude Haiku summary used as the
embedding-context prefix (same pattern as lib/blogs/contextualizer.ts).
DI seam for tests.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Upsert (content-hash dedupe + transactional write)

**Files:**
- Create: `lib/docs/upsert.ts`
- Create: `tests/lib/docs/upsert.test.ts`

Mirrors `lib/blogs/upsert.ts`: SHA-256 of `contentMd`; if unchanged, just bump `last_fetched_at` and return `skipped`; if changed, DELETE existing page (CASCADE drops chunks) and INSERT new page + chunks in one transaction.

- [ ] **Step 1: Write the failing upsert test**

Create `tests/lib/docs/upsert.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { upsertDocPage } from '@/lib/docs/upsert';
import type { EmbeddedDocChunk, ParsedDocPage } from '@/lib/docs/types';

const TEST_URL = 'http://upsert-test.invalid/p1';

function zeroVec(): number[] {
  return new Array(1536).fill(0);
}

function fixturePage(contentMd = 'body'): ParsedDocPage {
  return {
    url: TEST_URL,
    tree: 'docs',
    category: 'test',
    title: 'Test Page',
    description: 'A test page.',
    contentMd,
    sections: [{ anchor: null, title: null, contentMd }],
  };
}

function fixtureChunks(): EmbeddedDocChunk[] {
  return [{
    chunkIndex: 0,
    sectionAnchor: null,
    sectionTitle: null,
    chunkText: 'body',
    contextualText: 'context: body',
    embedding: zeroVec(),
  }];
}

describe('upsertDocPage', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_docs_pages WHERE url = $1`, [TEST_URL]);
  });

  it('inserts a new page + chunks and returns kind="new"', async () => {
    const result = await upsertDocPage(fixturePage(), fixtureChunks());
    expect(result.kind).toBe('new');
    expect(result.chunkCount).toBe(1);

    const chunks = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM dalgo_docs_chunks WHERE page_id = $1`,
      [result.pageId],
    );
    expect(chunks.rows[0].n).toBe(1);
  });

  it('returns kind="skipped" when content_hash matches existing row', async () => {
    await upsertDocPage(fixturePage('SAME'), fixtureChunks());
    const second = await upsertDocPage(fixturePage('SAME'), fixtureChunks());
    expect(second.kind).toBe('skipped');
  });

  it('returns kind="updated" + replaces chunks when content_hash differs', async () => {
    const first = await upsertDocPage(fixturePage('OLD'), fixtureChunks());
    const newChunks: EmbeddedDocChunk[] = [
      { chunkIndex: 0, sectionAnchor: null, sectionTitle: null, chunkText: 'a', contextualText: 'ctx-a', embedding: zeroVec() },
      { chunkIndex: 1, sectionAnchor: 'b', sectionTitle: 'B', chunkText: 'b', contextualText: 'ctx-b', embedding: zeroVec() },
    ];
    const second = await upsertDocPage(fixturePage('NEW'), newChunks);
    expect(second.kind).toBe('updated');
    expect(second.pageId).toBe(first.pageId);  // same row, replaced in place

    const chunks = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM dalgo_docs_chunks WHERE page_id = $1`,
      [second.pageId],
    );
    expect(chunks.rows[0].n).toBe(2);
  });

  afterAll(async () => {
    await query(`DELETE FROM dalgo_docs_pages WHERE url = $1`, [TEST_URL]);
    await pool().end();
  });
});
```

- [ ] **Step 2: Run test to confirm fail**

Run: `npm test -- tests/lib/docs/upsert.test.ts`
Expected: FAIL with `Cannot find module '@/lib/docs/upsert'`.

- [ ] **Step 3: Implement the upsert**

Create `lib/docs/upsert.ts`:

```typescript
// lib/docs/upsert.ts
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query, withClient } from '@/lib/db/client';
import type { DocUpsertResult, EmbeddedDocChunk, ParsedDocPage } from './types';

function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

export async function upsertDocPage(
  page: ParsedDocPage,
  chunks: EmbeddedDocChunk[],
): Promise<DocUpsertResult> {
  const contentHash = createHash('sha256').update(page.contentMd).digest('hex');

  const existing = await query<{ id: string; content_hash: string }>(
    `SELECT id, content_hash FROM dalgo_docs_pages WHERE url = $1`,
    [page.url],
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (row.content_hash === contentHash) {
      await query(
        `UPDATE dalgo_docs_pages SET last_fetched_at = now() WHERE id = $1`,
        [row.id],
      );
      return { kind: 'skipped', pageId: row.id, chunkCount: chunks.length };
    }
    // Content changed: replace page + chunks atomically.
    await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        await client.query(`DELETE FROM dalgo_docs_chunks WHERE page_id = $1`, [row.id]);
        await client.query(
          `UPDATE dalgo_docs_pages
             SET tree = $1, category = $2, title = $3, description = $4,
                 content_md = $5, content_hash = $6, last_fetched_at = now()
           WHERE id = $7`,
          [page.tree, page.category, page.title, page.description,
           page.contentMd, contentHash, row.id],
        );
        await insertChunksOnClient(client, row.id, chunks);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    });
    return { kind: 'updated', pageId: row.id, chunkCount: chunks.length };
  }

  // New page
  const pageId = await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO dalgo_docs_pages
           (url, tree, category, title, description, content_md, content_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [page.url, page.tree, page.category, page.title, page.description,
         page.contentMd, contentHash],
      );
      const id = ins.rows[0].id;
      await insertChunksOnClient(client, id, chunks);
      await client.query('COMMIT');
      return id;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  });
  return { kind: 'new', pageId, chunkCount: chunks.length };
}

async function insertChunksOnClient(
  client: PoolClient,
  pageId: string,
  chunks: EmbeddedDocChunk[],
): Promise<void> {
  for (const c of chunks) {
    await client.query(
      `INSERT INTO dalgo_docs_chunks
         (page_id, chunk_index, section_anchor, section_title,
          chunk_text, contextual_text, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7::vector)`,
      [pageId, c.chunkIndex, c.sectionAnchor, c.sectionTitle,
       c.chunkText, c.contextualText, vectorLiteral(c.embedding)],
    );
  }
}
```

- [ ] **Step 4: Run upsert tests to verify pass**

Run: `npm test -- tests/lib/docs/upsert.test.ts`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/docs/upsert.ts tests/lib/docs/upsert.test.ts
git commit -m "$(cat <<'EOF'
feat(docs): upsert with content-hash dedupe + transactional rewrite

Skip path when content_hash unchanged (just bump last_fetched_at).
Updated path uses one withClient transaction: BEGIN -> DELETE chunks ->
UPDATE page -> INSERT new chunks -> COMMIT. New path: INSERT page +
chunks atomically. Mirrors lib/blogs/upsert.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Ingest orchestrator + seed-docs CLI

**Files:**
- Create: `lib/docs/ingest.ts`
- Create: `scripts/seed-docs.ts`
- Modify: `package.json` (add `seed:docs` script)

- [ ] **Step 1: Implement the orchestrator**

Create `lib/docs/ingest.ts`:

```typescript
// lib/docs/ingest.ts
import { embed } from '@/lib/embeddings';
import { query } from '@/lib/db/client';
import { fetchSitemap } from './indexer';
import { fetchDocPage } from './fetcher';
import { parseDocPage } from './parser';
import { chunkDocPage } from './chunker';
import { generateChunkContext } from './contextualizer';
import { upsertDocPage } from './upsert';
import type { DocsJobSummary, EmbeddedDocChunk } from './types';

export interface DocsIngestOpts {
  force?: boolean;                 // pass through to fetcher (skip disk cache)
  onProgress?: (s: DocsJobSummary) => Promise<void> | void;
}

export async function runDocsIngest(opts: DocsIngestOpts = {}): Promise<DocsJobSummary> {
  const summary: DocsJobSummary = {
    pagesSeen: 0,
    pagesNew: 0,
    pagesUpdated: 0,
    pagesSkipped: 0,
    pagesRemoved: 0,
  };

  const refs = await fetchSitemap();
  const seenUrls = new Set<string>();

  for (const ref of refs) {
    summary.pagesSeen++;
    seenUrls.add(ref.url);
    try {
      const raw = await fetchDocPage(ref, { force: opts.force });
      const parsed = parseDocPage(raw);
      const chunks = chunkDocPage(parsed);

      // Per-chunk contextualization + embedding (sequential per page; sites are small).
      const embedded: EmbeddedDocChunk[] = [];
      for (const c of chunks) {
        const ctx = await generateChunkContext(parsed, c);
        const contextualText = `${ctx}\n\n${c.chunkText}`;
        const embedding = await embed(contextualText);
        embedded.push({ ...c, contextualText, embedding });
      }

      const result = await upsertDocPage(parsed, embedded);
      if (result.kind === 'new') summary.pagesNew++;
      else if (result.kind === 'updated') summary.pagesUpdated++;
      else summary.pagesSkipped++;
    } catch (e) {
      console.error(`[docs-ingest] failed for ${ref.url}:`, e);
    }
    if (opts.onProgress) await opts.onProgress(summary);
  }

  // Cleanup: any DB rows whose URL is no longer in the sitemap → delete.
  const dbUrls = await query<{ url: string }>(`SELECT url FROM dalgo_docs_pages`);
  for (const { url } of dbUrls.rows) {
    if (!seenUrls.has(url)) {
      await query(`DELETE FROM dalgo_docs_pages WHERE url = $1`, [url]);
      summary.pagesRemoved++;
    }
  }

  return summary;
}
```

- [ ] **Step 2: Create the CLI entry**

Create `scripts/seed-docs.ts`:

```typescript
// scripts/seed-docs.ts
import 'dotenv/config';
import { runDocsIngest } from '@/lib/docs/ingest';
import { pool } from '@/lib/db/client';

async function main() {
  const force = process.argv.includes('--force');
  console.log(`[seed-docs] starting docs ingest (force=${force})`);
  const result = await runDocsIngest({
    force,
    onProgress: async (s) => {
      process.stdout.write(
        `\r[seed-docs] seen ${s.pagesSeen} · new ${s.pagesNew} · updated ${s.pagesUpdated} · skipped ${s.pagesSkipped}    `,
      );
    },
  });
  console.log('\n[seed-docs] done:', result);
  await pool().end();
}

main().catch(async (e) => {
  console.error('[seed-docs] fatal:', e);
  await pool().end().catch(() => {});
  process.exit(1);
});
```

- [ ] **Step 3: Add the npm script**

Open `package.json`. Find the `"scripts"` block (look for the existing `"seed:kb"` line as a reference). Add:

```json
    "seed:docs": "DOTENV_CONFIG_PATH=.env.local tsx scripts/seed-docs.ts",
```

Verify with: `grep '"seed:docs"' package.json`

- [ ] **Step 4: Run the ingest against the live docs site**

```bash
npm run seed:docs
```

Expected: a few minutes of progress output (depending on docs page count and Anthropic API latency), ending with something like:
```
[seed-docs] done: { pagesSeen: ~30-150, pagesNew: ~30-150, pagesUpdated: 0, pagesSkipped: 0, pagesRemoved: 0 }
```

Then verify in psql:

```bash
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery -c \
  "SELECT tree, COUNT(*) AS pages, SUM(chunk_count) AS chunks
     FROM dalgo_docs_pages p
     LEFT JOIN (SELECT page_id, COUNT(*) AS chunk_count FROM dalgo_docs_chunks GROUP BY page_id) c
       ON c.page_id = p.id
    GROUP BY tree;"
```

Expected: at least one row for `tree='docs'`; possibly a row for `tree='resources'` if Resources tab pages exist in the sitemap.

- [ ] **Step 5: Commit**

```bash
git add lib/docs/ingest.ts scripts/seed-docs.ts package.json
git commit -m "$(cat <<'EOF'
feat(docs): ingest orchestrator + seed:docs CLI

Walks sitemap, fetches each page, parses, chunks, contextualizes,
embeds, upserts. Removes DB rows whose URL is no longer in the sitemap
(handles upstream page deletes). CLI: npm run seed:docs [--force].

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Retrieval helpers + search_dalgo_docs tool

**Files:**
- Create: `lib/db/queries/docs.ts`
- Create: `lib/llm/tools/search-dalgo-docs.ts`
- Modify: `lib/llm/tools/index.ts`
- Create: `tests/lib/db/docs-queries.test.ts`

- [ ] **Step 1: Write the failing query test**

Create `tests/lib/db/docs-queries.test.ts`:

```typescript
import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';
import { vectorSearchDocs, lexicalSearchDocs } from '@/lib/db/queries/docs';

describe('docs query helpers', () => {
  it('vectorSearchDocs returns ranked chunks with page metadata', async () => {
    const count = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM dalgo_docs_chunks`,
    );
    if (count.rows[0].n === 0) {
      console.warn('[docs-queries.test] skipping — no chunks seeded; run `npm run seed:docs` first');
      return;
    }
    const hits = await vectorSearchDocs('how do I create a chart', 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].page_url).toBeTruthy();
    expect(hits[0].page_title).toBeTruthy();
    expect(typeof hits[0].distance).toBe('number');
  });

  it('lexicalSearchDocs returns chunks matching the query terms', async () => {
    const count = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM dalgo_docs_chunks`,
    );
    if (count.rows[0].n === 0) return;
    const hits = await lexicalSearchDocs('dashboard', 5);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('vectorSearchDocs respects the tree filter', async () => {
    const count = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM dalgo_docs_chunks`,
    );
    if (count.rows[0].n === 0) return;
    const docsOnly = await vectorSearchDocs('how do I', 10, 'docs');
    for (const h of docsOnly) {
      expect(h.tree).toBe('docs');
    }
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run test to confirm fail**

Run: `npm test -- tests/lib/db/docs-queries.test.ts`
Expected: FAIL with `Cannot find module '@/lib/db/queries/docs'`.

- [ ] **Step 3: Implement the query helpers**

Create `lib/db/queries/docs.ts`:

```typescript
// lib/db/queries/docs.ts
import { query } from '../client';
import { embed } from '@/lib/embeddings';

export interface DocsChunkHit {
  chunk_id: string;
  page_id: string;
  page_url: string;
  page_title: string;
  tree: 'docs' | 'resources';
  section_anchor: string | null;
  section_title: string | null;
  chunk_text: string;
  distance?: number;   // present for vector hits (lower = closer)
  rank?: number;       // present for lexical hits
}

function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

export async function vectorSearchDocs(
  q: string,
  topK = 20,
  treeFilter?: 'docs' | 'resources',
): Promise<DocsChunkHit[]> {
  const e = await embed(q);
  const treeClause = treeFilter ? `WHERE p.tree = '${treeFilter}'` : '';
  const { rows } = await query<DocsChunkHit>(
    `SELECT c.id AS chunk_id, c.page_id, p.url AS page_url, p.title AS page_title, p.tree,
            c.section_anchor, c.section_title, c.chunk_text,
            (c.embedding <=> $1::vector)::float AS distance
       FROM dalgo_docs_chunks c
       JOIN dalgo_docs_pages p ON p.id = c.page_id
       ${treeClause}
   ORDER BY c.embedding <=> $1::vector
      LIMIT $2`,
    [vectorLiteral(e), topK],
  );
  return rows;
}

export async function lexicalSearchDocs(
  q: string,
  topK = 20,
  treeFilter?: 'docs' | 'resources',
): Promise<DocsChunkHit[]> {
  const treeClause = treeFilter ? `AND p.tree = '${treeFilter}'` : '';
  const { rows } = await query<DocsChunkHit>(
    `SELECT c.id AS chunk_id, c.page_id, p.url AS page_url, p.title AS page_title, p.tree,
            c.section_anchor, c.section_title, c.chunk_text,
            ts_rank_cd(c.tsv, plainto_tsquery('english', $1))::float AS rank
       FROM dalgo_docs_chunks c
       JOIN dalgo_docs_pages p ON p.id = c.page_id
      WHERE c.tsv @@ plainto_tsquery('english', $1)
        ${treeClause}
   ORDER BY rank DESC
      LIMIT $2`,
    [q, topK],
  );
  return rows;
}
```

- [ ] **Step 4: Run query tests**

Run: `npm test -- tests/lib/db/docs-queries.test.ts`
Expected: PASS (or skip with warning if `dalgo_docs_chunks` is empty — Task 7 should have seeded it).

- [ ] **Step 5: Implement the search tool**

Create `lib/llm/tools/search-dalgo-docs.ts`:

```typescript
// lib/llm/tools/search-dalgo-docs.ts
import { tool } from 'ai';
import { z } from 'zod';
import { vectorSearchDocs, lexicalSearchDocs } from '@/lib/db/queries/docs';
import { fuseRrf } from '@/lib/llm/rag/rrf';
import { emit } from '@/lib/telemetry';

export function searchDalgoDocsTool(sessionId: string) {
  return tool({
    description:
      'Search the official Dalgo product documentation for how-to / procedural / configuration content. Use this when the user asks "how do I…", "where do I find…", or any product-usage question that a help article would answer (creating charts, scheduling refreshes, managing users, setting up a connector). Returns up to 5 relevant doc sections with their canonical URL and section anchor — cite the URL in your reply, and if section_anchor is set, the citation MUST include #<anchor> so the user lands on the right section.',
    parameters: z.object({
      query: z.string().describe('What to look up in the docs corpus'),
      tree: z.enum(['docs', 'resources']).optional()
        .describe('Optional filter; defaults to both trees'),
      top_k: z.number().int().min(1).max(10).default(5),
    }),
    execute: async ({ query: q, tree, top_k }) => {
      const [vec, lex] = await Promise.all([
        vectorSearchDocs(q, 20, tree),
        lexicalSearchDocs(q, 20, tree),
      ]);
      const fused = fuseRrf({
        lists: [
          vec.map((h) => ({ id: h.chunk_id, source: 'docs', ...h })),
          lex.map((h) => ({ id: h.chunk_id, source: 'docs', ...h })),
        ],
        topK: top_k,
      });
      const topScore = fused[0]?.score ?? 0;
      await emit(
        topScore > 0.3 ? 'docs_hit' : 'docs_miss',
        { query: q, count: fused.length, top_score: topScore },
        sessionId,
      );
      return {
        results: fused.map((f) => {
          const it = f.item as DocsChunkHit;
          return {
            page_url: it.page_url,
            section_anchor: it.section_anchor,
            section_title: it.section_title,
            page_title: it.page_title,
            tree: it.tree,
            snippet: it.chunk_text.slice(0, 200),
            score: Math.round(f.score * 1000) / 1000,
          };
        }),
      };
    },
  });
}

// Local re-export of the hit type so the execute callback can narrow safely.
type DocsChunkHit = {
  chunk_id: string; page_id: string; page_url: string; page_title: string;
  tree: 'docs' | 'resources'; section_anchor: string | null;
  section_title: string | null; chunk_text: string;
};
```

- [ ] **Step 6: Register the tool in `buildToolset`**

Open `lib/llm/tools/index.ts`. Add the import + registration. The full file should read:

```typescript
import { searchDalgoKbTool } from './search-dalgo-kb';
import { searchDalgoBlogsTool } from './search-dalgo-blogs';
import { searchDalgoDocsTool } from './search-dalgo-docs';
import { matchProblemPatternTool } from './match-problem-pattern';
import { fetchNgoWebsiteTool } from './fetch-ngo-website';
import { parsePdfTool } from './parse-pdf';
import { requestDemoTool } from './request-demo';
import { suggestRepliesTool } from './suggest-replies';

export function buildToolset(sessionId: string) {
  return {
    search_dalgo_kb: searchDalgoKbTool(sessionId),
    search_dalgo_blogs: searchDalgoBlogsTool(sessionId),
    search_dalgo_docs: searchDalgoDocsTool(sessionId),
    match_problem_pattern: matchProblemPatternTool(sessionId),
    fetch_ngo_website: fetchNgoWebsiteTool(sessionId),
    parse_pdf: parsePdfTool(sessionId),
    request_demo: requestDemoTool(sessionId),
    suggest_replies: suggestRepliesTool(),
  };
}
```

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit
```
Expected: no NEW errors (only the documented pre-existing `.next/types/validator.ts` ref to deleted `/api/categories`).

- [ ] **Step 8: Commit**

```bash
git add lib/db/queries/docs.ts lib/llm/tools/search-dalgo-docs.ts lib/llm/tools/index.ts tests/lib/db/docs-queries.test.ts
git commit -m "$(cat <<'EOF'
feat(docs): search_dalgo_docs tool + retrieval helpers

vectorSearchDocs + lexicalSearchDocs with optional tree filter, fused
via fuseRrf (same as blogs). Tool emits docs_hit / docs_miss telemetry
(threshold 0.3, same as KB). Tool description tells the LLM to append
#section_anchor to citations when present.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Teach the bot to use the tool (two prompt edits via SQL)

**Files:**
- Create: `scripts/migrations/004_prompt_docs_tool.sql` (one-shot, idempotent prompt UPDATEs + version snapshots)

These are NOT source-file edits to `staticSystem()` — the prompts live in the `dalgo_prompts` table since the admin-editable-prompts feature shipped. We write a SQL migration to do the UPDATE + INSERT version snapshot atomically.

- [ ] **Step 1: Create the prompt migration**

Create `scripts/migrations/004_prompt_docs_tool.sql`:

```sql
-- 004_prompt_docs_tool.sql — teach the bot when to call search_dalgo_docs
-- Apply with:
--   docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery \
--     < scripts/migrations/004_prompt_docs_tool.sql
BEGIN;

-- Edit 1: tools_inventory — add the new tool bullet
UPDATE dalgo_prompts
   SET content = $prompt$You have:
  • A knowledge base of Dalgo's exact capabilities (call search_dalgo_kb)
  • Tools to learn about the NGO (fetch_ngo_website, parse_pdf)
  • A way to capture interest (request_demo)
  • A way to offer the user clickable next-step suggestions (suggest_replies)
  • A way to look up official how-to / reference content from Dalgo's product docs (call search_dalgo_docs)$prompt$,
       updated_by = 'system+admin@dalgo.org',
       updated_at = now()
 WHERE key = 'tools_inventory';

INSERT INTO dalgo_prompt_versions (prompt_key, content, updated_by, updated_at)
SELECT key, content, updated_by, updated_at
  FROM dalgo_prompts WHERE key = 'tools_inventory';

-- Edit 2: rules — extend rule 9 with the docs tool sub-bullet
UPDATE dalgo_prompts
   SET content = $prompt$Rules:
1. Ground every capability claim by calling search_dalgo_kb. Cite the KB entry by paraphrasing its content; do not invent capabilities.
2. If the KB says "no", "partial", or "roadmap" — say so honestly. Suggest genuine workarounds where they exist.
3. Connect NGO context to Dalgo: "Since you use <X>, here's how Dalgo would..."
4. Never invent connectors, chart types, or features not present in the KB.
5. If asked something outside Dalgo's scope, be helpful briefly, then redirect to Dalgo fit.
6. Soft CTA every 3–4 turns (offer demo, personalized PDF report).
7. Detect deal-breakers early and surface them honestly.
8. **At the end of nearly every reply, call suggest_replies with 2-4 short suggested next replies.** These should be follow-up questions or clarifications the user is likely to want next. Phrase them from the user's perspective ("I use X", "Yes, tell me more", "What about pricing?"). Skip suggest_replies only when the conversation has clearly ended (user said goodbye, or after request_demo).
9. **Three retrieval tools beyond search_dalgo_kb:**
   - call `search_dalgo_blogs` when the user mentions a specific tool (Kobo, DHIS2, ODK, Power BI), a sector (maternal health, education), or asks how other NGOs have approached something. Cite returned article URLs.
   - call `match_problem_pattern` when the user describes a *problem* in their own words ("we have no system", "data is everywhere") rather than asking a specific feature question. Use the returned consultant_framing and dalgo_response as the spine of your reply.
   - call `search_dalgo_docs` when the user asks "how do I…", "where do I find…", or any procedural / configuration question that an in-product help article would answer (creating charts, scheduling refreshes, managing users, setting up a connector). Cite the returned URL — if `section_anchor` is set, the bot's citation MUST include `#<anchor>` so the user lands on the right section.

10. **Citation discipline: every URL in your reply MUST have come from a tool result on this turn.** Never invent URLs, customer names, or capabilities. If you don't have a relevant citation, say: "I don't have a specific case study for this — would you like me to flag it for the Dalgo team to share one?" Faking a connection (claiming Bhumi/SHRI/STiR/etc. did something they didn't) is the single worst failure mode for this bot — refuse it absolutely.

11. **Progressive disclosure (NGO-friendly first).** Most users are NGO program leads, EDs, or M&E heads — smart, but not product-savvy. Default to Dalgo's user-facing surface in plain language:
    - say "Dalgo's connectors" or "Dalgo can pull data from <source>" — NOT bare "Airbyte"
    - say "Dalgo schedules your pipelines" or "Dalgo orchestrates the refresh" — NOT bare "Prefect"
    - say "Dalgo's transformation UI" or "Dalgo's no-code transformation editor (built on dbt)" — NOT bare "dbt models"
    Engine names (Airbyte, Prefect, dbt-as-bare-term) get unlocked only when ANY of these are true:
      (a) the user explicitly asks about internals ("what's it built on?", "what's the stack?", "what runs the orchestration?")
      (b) the user names the engine first ("we already use Airbyte", "our data engineer knows dbt")
      (c) someone identifies as technical ("I'm the data engineer at X", "I'm CTO of Y")
    **Superset / Power BI / Looker / Tableau remain nameable any time** — they are real products NGOs evaluate, buy, or already use, so naming them is informative. The Superset add-on is especially load-bearing because it's a paid option (₹48,000/year) NGOs need the word for.
    **This rule changes vocabulary, NOT honesty.** If asked whether Dalgo has RLS, the honest answer is still "no, that's a Superset feature" — never soften the Dalgo-vs-3rd-party boundary to be polite. See Rule 12 for the boundary discipline.$prompt$,
       updated_by = 'system+admin@dalgo.org',
       updated_at = now()
 WHERE key = 'rules';

INSERT INTO dalgo_prompt_versions (prompt_key, content, updated_by, updated_at)
SELECT key, content, updated_by, updated_at
  FROM dalgo_prompts WHERE key = 'rules';

COMMIT;
```

**IMPORTANT NOTE FOR THE IMPLEMENTER:** Before saving this migration, read the CURRENT content of the `rules` row from the DB to confirm the rule-11 (progressive disclosure) text is still what's pasted above. The rule-11 text was added earlier in this session and is the live ground truth; if a teammate has edited it since, your migration would silently overwrite their edit. Run:

```bash
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery -c \
  "SELECT content FROM dalgo_prompts WHERE key = 'rules';"
```

Diff visually against the rule-11 block in the migration. If they differ in any way: pull the live content into your migration verbatim, change ONLY rule 9 to include the new sub-bullet, leave everything else identical. The whole point of having admin-editable prompts is that source-of-truth lives in the DB, not in source files.

- [ ] **Step 2: Apply the migration**

```bash
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery \
  < scripts/migrations/004_prompt_docs_tool.sql
```

Expected output:
```
BEGIN
UPDATE 1
INSERT 0 1
UPDATE 1
INSERT 0 1
COMMIT
```

- [ ] **Step 3: Verify version history**

```bash
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery -c \
  "SELECT prompt_key, COUNT(*) AS versions
     FROM dalgo_prompt_versions
    WHERE prompt_key IN ('tools_inventory', 'rules')
    GROUP BY prompt_key;"
```

Expected: each key has at least 2 versions (initial seed + this edit; possibly more if there were prior edits).

- [ ] **Step 4: Verify the bot will pick up the change**

The `staticSystem()` cache has a 60-second TTL. If a dev server is running, the next chat request within 60s might still see old content. For the eval run in Task 12, restart any dev server or wait 60s.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrations/004_prompt_docs_tool.sql
git commit -m "$(cat <<'EOF'
feat(prompts): teach bot to call search_dalgo_docs

tools_inventory section gains a 6th bullet pointing at search_dalgo_docs.
rules section's rule 9 extended with a third sub-bullet describing when
to call the new tool. Both edits land via UPDATE + version snapshot in
one transaction. Future updates to these sections should happen via
/admin/prompts, not SQL.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Admin UI (`/admin/docs` list + detail + refresh)

**Files:**
- Create: `app/admin/docs/page.tsx`
- Create: `app/admin/docs/[id]/page.tsx`
- Create: `app/api/admin/docs/refresh/route.ts`
- Create: `components/admin/refresh-docs-button.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Implement the list page**

Create `app/admin/docs/page.tsx`:

```typescript
import Link from 'next/link';
import { query } from '@/lib/db/client';
import { RefreshDocsButton } from '@/components/admin/refresh-docs-button';

type Row = {
  id: string;
  url: string;
  tree: 'docs' | 'resources';
  category: string;
  title: string;
  last_fetched_at: string;
  chunk_count: number;
};

export default async function DocsListPage() {
  const { rows } = await query<Row>(
    `SELECT p.id, p.url, p.tree, p.category, p.title, p.last_fetched_at,
            COALESCE(c.n, 0)::int AS chunk_count
       FROM dalgo_docs_pages p
       LEFT JOIN (SELECT page_id, COUNT(*) AS n FROM dalgo_docs_chunks GROUP BY page_id) c
         ON c.page_id = p.id
      ORDER BY p.tree, p.category, p.title`,
  );

  // Group rows by tree → category
  const grouped: Record<string, Record<string, Row[]>> = {};
  for (const r of rows) {
    grouped[r.tree] ??= {};
    grouped[r.tree][r.category] ??= [];
    grouped[r.tree][r.category].push(r);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-2xl">Docs</h2>
          <p className="text-sm text-slate-500">
            Pages ingested from dalgot4d.github.io/dalgo_docs.
            Click Refresh after the docs repo is updated.
          </p>
        </div>
        <RefreshDocsButton />
      </div>

      {Object.keys(grouped).sort().map((tree) => (
        <section key={tree} className="space-y-3">
          <h3 className="text-lg font-medium text-slate-900">
            {tree === 'docs' ? 'Documentation' : 'Resources'} — {Object.values(grouped[tree]).reduce((n, arr) => n + arr.length, 0)} pages
          </h3>
          {Object.keys(grouped[tree]).sort().map((cat) => (
            <div key={cat} className="space-y-1">
              <h4 className="text-xs uppercase tracking-wide text-slate-500">{cat}</h4>
              <ul className="border rounded divide-y">
                {grouped[tree][cat].map((r) => (
                  <li key={r.id} className="p-3 hover:bg-slate-50">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link href={`/admin/docs/${r.id}`} className="font-medium text-slate-900 hover:underline">
                        {r.title}
                      </Link>
                      <span className="text-xs text-slate-500">
                        {r.chunk_count} chunk{r.chunk_count === 1 ? '' : 's'} · {new Date(r.last_fetched_at).toLocaleDateString()}
                      </span>
                    </div>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 hover:underline break-all"
                    >
                      {r.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}

      {rows.length === 0 && (
        <p className="text-slate-500">No docs ingested yet. Click Refresh to run the ingest.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement the detail page**

Create `app/admin/docs/[id]/page.tsx`:

```typescript
import { query } from '@/lib/db/client';

type Page = {
  id: string;
  url: string;
  tree: string;
  category: string;
  title: string;
  description: string | null;
  content_hash: string;
  last_fetched_at: string;
};

type Chunk = {
  chunk_index: number;
  section_anchor: string | null;
  section_title: string | null;
  contextual_text: string;
};

export default async function DocDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const page = await query<Page>(
    `SELECT id, url, tree, category, title, description, content_hash, last_fetched_at
       FROM dalgo_docs_pages WHERE id = $1`,
    [id],
  );
  if (!page.rows[0]) return <p>Not found.</p>;
  const p = page.rows[0];

  const chunks = await query<Chunk>(
    `SELECT chunk_index, section_anchor, section_title, contextual_text
       FROM dalgo_docs_chunks
      WHERE page_id = $1
      ORDER BY chunk_index`,
    [id],
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl">{p.title}</h2>
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-700 hover:underline break-all"
        >
          {p.url}
        </a>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm bg-slate-50 p-3 rounded">
        <dt className="text-slate-500">Tree</dt>
        <dd>{p.tree}</dd>
        <dt className="text-slate-500">Category</dt>
        <dd>{p.category}</dd>
        <dt className="text-slate-500">Last fetched</dt>
        <dd>{new Date(p.last_fetched_at).toLocaleString()}</dd>
        <dt className="text-slate-500">Content hash</dt>
        <dd className="font-mono text-xs">{p.content_hash.slice(0, 16)}…</dd>
      </dl>

      {p.description && (
        <p className="text-sm text-slate-700 italic">{p.description}</p>
      )}

      <div>
        <h3 className="font-medium mb-2">Chunks ({chunks.rows.length})</h3>
        <ul className="space-y-2">
          {chunks.rows.map((c) => (
            <li key={c.chunk_index} className="border rounded p-3">
              <div className="flex items-baseline gap-2 text-xs text-slate-500 mb-1">
                <span>#{c.chunk_index}</span>
                {c.section_anchor && (
                  <a
                    href={`${p.url}#${c.section_anchor}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline font-mono"
                    title={`${p.url}#${c.section_anchor}`}
                  >
                    #{c.section_anchor}
                  </a>
                )}
                {c.section_title && <span className="font-medium">{c.section_title}</span>}
                {!c.section_anchor && <span className="italic">(intro)</span>}
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {c.contextual_text.slice(0, 300)}{c.contextual_text.length > 300 ? '…' : ''}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement the refresh API route**

Create `app/api/admin/docs/refresh/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runDocsIngest } from '@/lib/docs/ingest';

export const maxDuration = 300; // allow up to 5 minutes for the in-request ingest

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const summary = await runDocsIngest();
    return NextResponse.json({ summary });
  } catch (e) {
    return NextResponse.json(
      { error: 'refresh failed', detail: String(e) },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Implement the refresh button component**

Create `components/admin/refresh-docs-button.tsx`:

```typescript
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Summary = {
  pagesSeen: number;
  pagesNew: number;
  pagesUpdated: number;
  pagesSkipped: number;
  pagesRemoved: number;
};

export function RefreshDocsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/docs/refresh', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResult(json.summary);
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="px-3 py-1 bg-slate-900 text-white rounded text-sm disabled:opacity-40"
      >
        {loading ? 'Refreshing… (up to a few minutes)' : 'Refresh docs'}
      </button>
      {result && (
        <span className="text-xs text-slate-600">
          seen {result.pagesSeen} · new {result.pagesNew} · updated {result.pagesUpdated}
          · skipped {result.pagesSkipped} · removed {result.pagesRemoved}
        </span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 5: Add the sidebar nav link**

Open `app/admin/layout.tsx`. Find the `<Link>` element pointing to `/admin/blogs` and add the docs link immediately after it. The existing block (excerpt) looks like:

```tsx
<Link className="block hover:underline" href="/admin/blogs">
  Blogs
</Link>
<Link className="block hover:underline" href="/admin/unanswered">
  Unanswered{' '}
  {/* ... */}
</Link>
```

Insert the Docs link between Blogs and Unanswered:

```tsx
<Link className="block hover:underline" href="/admin/blogs">
  Blogs
</Link>
<Link className="block hover:underline" href="/admin/docs">
  Docs
</Link>
<Link className="block hover:underline" href="/admin/unanswered">
  Unanswered{' '}
  {/* ... */}
</Link>
```

- [ ] **Step 6: Manual smoke test**

```bash
npm run dev &
sleep 5
curl -sI http://localhost:3000/admin/docs | head -1
pkill -f "next dev"
```
Expected: `HTTP/1.1 307 Temporary Redirect` (the admin auth layout redirects unauthenticated requests to `/signin` — confirms the page route exists, compiles cleanly, and the auth gate fires).

Then if you have the dev server running with an active admin session, browse to `http://localhost:3000/admin/docs` and confirm:
- Sidebar shows "Docs" between Blogs and Unanswered
- Page lists ingested pages grouped by tree → category
- Clicking a page row loads the detail page with chunks
- "Refresh docs" button visible; clicking it spins for ~30-60s then shows result counts

- [ ] **Step 7: Commit**

```bash
git add app/admin/docs app/api/admin/docs components/admin/refresh-docs-button.tsx app/admin/layout.tsx
git commit -m "$(cat <<'EOF'
feat(admin): /admin/docs list + detail + refresh button

List groups pages by tree -> category, shows chunk count + last_fetched_at.
Detail page shows page metadata + per-chunk preview with clickable
deep-link to the upstream section anchor. Refresh button POSTs to
/api/admin/docs/refresh which runs runDocsIngest in-request (up to ~5
min via maxDuration). Sidebar nav adds Docs between Blogs and Unanswered.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Refresh-endpoint auth test

**Files:**
- Create: `tests/api/admin/docs-refresh.test.ts`

Light test that the route is auth-gated. Does NOT exercise the full ingest (would hit network + Anthropic).

- [ ] **Step 1: Write the test**

Create `tests/api/admin/docs-refresh.test.ts`:

```typescript
import { describe, it, expect, afterAll, vi } from 'vitest';
import 'dotenv/config';
import { pool } from '@/lib/db/client';

// vi.mock is hoisted by Vitest above all imports — visual order in source does not matter.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock the ingest so the test does not hit network / Anthropic.
vi.mock('@/lib/docs/ingest', () => ({
  runDocsIngest: vi.fn(async () => ({
    pagesSeen: 0, pagesNew: 0, pagesUpdated: 0, pagesSkipped: 0, pagesRemoved: 0,
  })),
}));

import { POST } from '@/app/api/admin/docs/refresh/route';
import { auth } from '@/lib/auth';

function req(): any {
  return new Request('http://test/api/admin/docs/refresh', { method: 'POST' });
}

describe('POST /api/admin/docs/refresh', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('returns 200 + summary when authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'test@dalgo.org' } } as any);
    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.summary).toBeTruthy();
    expect(json.summary.pagesSeen).toBe(0);
  });

  afterAll(async () => { await pool().end(); });
});
```

Note: `POST` exported from `app/api/admin/docs/refresh/route.ts` takes no args — the `req()` helper is unused but kept for symmetry with other admin tests; harmless.

- [ ] **Step 2: Run the test**

Run: `npm test -- tests/api/admin/docs-refresh.test.ts`
Expected: PASS, 2 tests green.

- [ ] **Step 3: Commit**

```bash
git add tests/api/admin/docs-refresh.test.ts
git commit -m "$(cat <<'EOF'
test(admin): docs refresh route is auth-gated + returns summary shape

Mocks runDocsIngest so test doesn't hit network. Confirms 401 when
unauthed and 200 with summary when authed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Eval bucket + register + run

**Files:**
- Create: `lib/llm/eval/cases/docs-citations.ts`
- Modify: `lib/llm/eval/runner.ts` (one import + one spread in `ALL`)

- [ ] **Step 1: Implement the cases file**

Create `lib/llm/eval/cases/docs-citations.ts`:

```typescript
// lib/llm/eval/cases/docs-citations.ts
//
// 6 how-to questions where the bot is expected to call search_dalgo_docs
// and cite a /docs/<category>/ URL. must_not_hallucinate_urls = true
// transitively asserts the tool was called (a /docs/... URL in the
// reply that didn't come from a tool would fail this check).

import type { EvalCase } from './types';

export const docsCitationsCases: EvalCase[] = [
  {
    id: 'dc-01',
    bucket: 'docs-citations',
    input: 'How do I create a chart in Dalgo?',
    expected: {
      must_cite_one_of: ['/docs/charts/'],
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge', 'llm-judge', 'exact-match'],
  },
  {
    id: 'dc-02',
    bucket: 'docs-citations',
    input: 'Where do I schedule a data refresh?',
    expected: {
      must_cite_one_of: ['/docs/data/'],
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge', 'llm-judge', 'exact-match'],
  },
  {
    id: 'dc-03',
    bucket: 'docs-citations',
    input: 'How do I share a dashboard with someone outside my org?',
    expected: {
      must_cite_one_of: ['/docs/dashboards/'],
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge', 'llm-judge', 'exact-match'],
  },
  {
    id: 'dc-04',
    bucket: 'docs-citations',
    input: "I'm new — what's the fastest way to get my first report set up?",
    expected: {
      must_cite_one_of: ['/docs/quickstart/'],
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge', 'llm-judge', 'exact-match'],
  },
  {
    id: 'dc-05',
    bucket: 'docs-citations',
    input: "What do you mean by 'connector' in Dalgo?",
    expected: {
      must_cite_one_of: ['/docs/concepts/glossary'],
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge', 'llm-judge', 'exact-match'],
  },
  {
    id: 'dc-06',
    bucket: 'docs-citations',
    input: 'Where do I add a new user to my workspace?',
    expected: {
      must_cite_one_of: ['/docs/settings/'],
      must_not_hallucinate_urls: true,
    },
    judge: ['retrieval-judge', 'llm-judge', 'exact-match'],
  },
];
```

- [ ] **Step 2: Register in `runner.ts`**

Open `lib/llm/eval/runner.ts`. Near the top of the file (look for the existing line `import { toolNameCases } from './cases/tool-names';`), add the import:

```typescript
import { docsCitationsCases } from './cases/docs-citations';
```

Then find the `ALL` constant (around line 133, looks like `const ALL: EvalCase[] = [`) and add `...docsCitationsCases,` at the end of the array:

```typescript
const ALL: EvalCase[] = [
  ...problemStatementCases,
  ...toolNameCases,
  ...citationCases,
  ...guardrailsCases,
  ...structureCases,
  ...docsCitationsCases,
];
```

(The exact existing spreads above may differ — match what's already there and append the new spread on its own line.)

- [ ] **Step 3: Typecheck + quick lint**

```bash
npx tsc --noEmit
```
Expected: no NEW errors.

- [ ] **Step 4: Run the eval**

```bash
npm run eval:new
```

Expected: takes ~12 min with the parallel runner from the previous feature. Output ends with a line like:
```
[eval:new] done. <N>/56 passed. Report: docs/eval-runs/2026-05-27-<HH-MM>.md
```

Open the report file. Acceptance gates:
- `docs-citations` bucket ≥ 5/6
- Total ≥ baseline 41/50 (i.e. the new docs feature didn't drop any other bucket)

If `docs-citations` < 5: investigate the failures by opening the report's "Failures" list. Common causes:
- The bot's retrieval brought a wrong section anchor → check the `contextual_text` for that page in the DB
- The URL substring expected doesn't match the live URL slug → adjust the expected substring (e.g. `/docs/charts/creating-charts` vs `/docs/charts/`)

Do NOT loosen the acceptance gate to make the suite pass. Fix the underlying cause.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/eval/cases/docs-citations.ts lib/llm/eval/runner.ts
git commit -m "$(cat <<'EOF'
test(eval): docs-citations bucket (6 cases)

Each case expects the bot to call search_dalgo_docs and cite a
/docs/<category>/ URL. must_not_hallucinate_urls transitively
asserts the tool was actually called (any /docs/... URL must
come from a tool result this turn).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

The eval report itself (`docs/eval-runs/2026-05-27-*.md`) is generated by the run and can be committed separately if desired — the project commits these per the precedent set in `docs/eval-runs/`.

- [ ] **Step 6 (optional): Commit the eval report**

```bash
git add docs/eval-runs/2026-05-27-*.md
git commit -m "test(eval): docs-citations baseline report"
```

---

## Task 13: JOURNAL entry

**Files:**
- Modify: `docs/JOURNAL.md` (append entry at top, BELOW the existing intro lines but ABOVE the most recent dated entry)

- [ ] **Step 1: Append the entry**

Open `docs/JOURNAL.md`. After the existing intro (`Append a dated entry...`) and the `---` separator, before the first dated `##` heading, insert the new entry:

```markdown
## 2026-05-27 — Dalgo product-docs corpus

**Added**
- `dalgo_docs_pages` + `dalgo_docs_chunks` tables; populated from `https://dalgot4d.github.io/dalgo_docs/sitemap.xml` (both Docs and Resources trees)
- `lib/docs/` ingestion pipeline (indexer → fetcher → parser → chunker → contextualizer → upsert → ingest) mirroring `lib/blogs/` shape, with Docusaurus-specific parser and h2-section-based chunking that preserves `#section-anchor` deep-link targets
- `npm run seed:docs` CLI (idempotent; `--force` flag bypasses both disk cache and content_hash skip)
- `search_dalgo_docs` LLM tool registered in `buildToolset(sessionId)` — third retrieval tool alongside `search_dalgo_kb` and `search_dalgo_blogs`
- `docs_hit` / `docs_miss` telemetry events (threshold 0.3 cosine, matches KB)
- Admin pages: `/admin/docs` (list grouped by tree → category, chunk count + last_fetched_at, Refresh button) and `/admin/docs/[id]` (read-only detail with per-chunk preview + section-anchor deep-links)
- `POST /api/admin/docs/refresh` — runs `runDocsIngest` in-request (maxDuration 5 min); button shows live counts + final summary
- Sidebar nav: `Docs` link between `Blogs` and `Unanswered`
- 6-case `docs-citations` eval bucket; each asserts a `/docs/<category>/` citation appears and is not hallucinated
- 2 prompt edits applied via SQL migration `004_prompt_docs_tool.sql` (UPDATE + version snapshot in one transaction): `tools_inventory` gains a 6th bullet for `search_dalgo_docs`; `rules` rule 9 extended with a third sub-bullet teaching the bot when to call the new tool. Future updates to these sections happen via `/admin/prompts`, not SQL.

**Removed**
- Nothing.

**Why**
- The bot was answering "how do I X" questions by improvising from KB entries that weren't written as procedural docs. Improvisations were often correct but cited the wrong source. Ingesting the canonical docs lets the bot send users directly to the right help-article section, with deep-links.
- The docs team owns the `DalgoT4D/dalgo_docs` GitHub repo; the admin Refresh button means they update docs there, the team clicks one button here, the bot reflects the change in minutes — no developer involvement.

**Eval delta**
- Baseline (commit `b00c5b1`): 41/50, `docs-citations` did not exist
- After this work: <N>/56 — `docs-citations` <K>/6 (acceptance gate ≥ 5/6 met)
- No other bucket regressed.
- Report at `docs/eval-runs/2026-05-27-<HH-MM>.md`

**Carried forward / next**
- Right-side docs panel UI (render the cited docs page in an iframe next to chat) — deferred to a follow-up spec; decide based on real chat data whether NGOs actually click through links or whether the link alone is sufficient
- Scheduled / cron-driven re-ingest — manual seed + admin Refresh covers v1
- Surfacing docs candidates in `<WrongAnswerModal>` — not actionable from the modal (fix path for docs is "edit upstream repo"), so the modal stays KB-only
- "Team Notes" free-form bucket (deferred — would let admins type one-liner facts without going through KB CRUD form)
- Branch `feat/blog-ingestion` still not pushed or merged — user-driven decision pending

**Refs**
- Spec: `docs/superpowers/specs/2026-05-27-dalgo-docs-ingestion-design.md`
- Plan: `docs/superpowers/plans/2026-05-27-dalgo-docs-ingestion.md`
- Team-facing operations guide: `docs/admin-guide/managing-the-knowledge-base.md`
- Branch: `feat/blog-ingestion`

---

```

Replace `<N>`, `<K>`, `<HH-MM>` with the actual values from the Task 12 eval run.

- [ ] **Step 2: Commit**

```bash
git add docs/JOURNAL.md
git commit -m "$(cat <<'EOF'
docs(journal): dalgo product-docs corpus ingestion shipped

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Schema (2 tables + indexes) → Task 1
- ✅ Migration → Task 1
- ✅ Indexer (sitemap walker) → Task 2
- ✅ Fetcher → Task 3
- ✅ Parser → Task 4
- ✅ Chunker → Task 5
- ✅ Contextualizer → Task 5
- ✅ Upsert → Task 6
- ✅ Orchestrator + CLI → Task 7
- ✅ `lib/db/queries/docs.ts` retrieval helpers → Task 8
- ✅ `search_dalgo_docs` tool + registration → Task 8
- ✅ Two prompt edits via SQL → Task 9
- ✅ Admin list page → Task 10
- ✅ Admin detail page → Task 10
- ✅ Refresh API route + button + sidebar link → Task 10
- ✅ Refresh route auth test → Task 11
- ✅ 6-case eval bucket → Task 12
- ✅ Eval run + acceptance gate → Task 12
- ✅ JOURNAL → Task 13
- ✅ Telemetry (`docs_hit` / `docs_miss`) → Task 8 (tool's `emit` call)

**2. Placeholder scan:** No `TBD` / `TODO` / "implement later" markers. Every step has either complete code, an exact command with expected output, or a Verify+Replace instruction (the JOURNAL `<N>`/`<K>`/`<HH-MM>` placeholders are explicit "fill in from eval run" markers, not vague handwaves).

**3. Type consistency:**
- `DocPageRef` (Task 2) referenced in `fetchDocPage` (Task 3) signature — matches.
- `RawDocPage` (Task 2) returned by fetcher, consumed by parser — matches.
- `ParsedDocPage.sections[]` (Task 2) consumed by `chunkDocPage` (Task 5) — field shape `DocSection { anchor, title, contentMd }` consistent.
- `EmbeddedDocChunk` extends `DocChunk` (Task 2) with `contextualText` + `embedding` — consumed by `upsertDocPage` (Task 6), produced by `runDocsIngest` (Task 7).
- `DocsChunkHit` (Task 8 queries file) consumed by the tool's execute callback (also Task 8) — re-declared locally in the tool file for narrowing; both shapes agree.
- `EvalCase` shape used in Task 12 cases file matches the existing `lib/llm/eval/cases/types.ts` exactly (verified during spec self-review).

**4. Risk callouts for the implementer:**
- **Task 4 parser depends on Docusaurus 3.x class names** (`article .theme-doc-markdown`, `<h2 class="anchor" id="...">`). The fixture HTML captured in Step 1 is the safety net: if Docusaurus changes its markup in a future upstream version, the parser test fails loudly before the next ingest is run in production.
- **Task 7 (live ingest) costs real API money** — ~$2-3 worth of Anthropic Haiku calls for the contextualizer plus a fraction of a cent for OpenAI embeddings, on the first full run. Incremental re-ingests cost a fraction of that (content_hash skip).
- **Task 9 SQL migration overwrites the live `rules` row.** The implementer MUST verify the current DB content matches the rule-11 block in the migration before applying. If a teammate has edited the live rule-11 content via `/admin/prompts`, the migration would silently lose that edit. The Verify step (Step 1 in Task 9) makes this explicit.
- **Task 12 eval run takes ~12 min and costs ~$0.50** (50 baseline cases + 6 new cases × ~$0.01/case). Don't re-run unless retrieval / synthesis / judges changed.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-27-dalgo-docs-ingestion.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration with isolated context.

**2. Inline Execution** — Execute tasks in this session using executing-plans, with batch execution + checkpoints for review.

Which approach?
