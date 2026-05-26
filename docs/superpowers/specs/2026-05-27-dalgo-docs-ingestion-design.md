# Dalgo product-docs corpus ingestion — Design

**Status:** approved, ready for implementation plan
**Branch:** `feat/blog-ingestion` (continues the same long-lived feature branch)
**Date:** 2026-05-27
**Related:**
- Spec: `2026-05-25-rag-upgrade-and-blog-ingestion-design.md` (the blog-corpus precedent this mirrors)
- Spec: `2026-05-26-admin-editable-prompts-design.md` (the prompts the bot uses; we add a new rule for `search_dalgo_docs`)
- Team-facing reference: `docs/admin-guide/managing-the-knowledge-base.md`

## Goal

Ingest the official Dalgo product docs from `https://dalgot4d.github.io/dalgo_docs/` into a third retrievable corpus (alongside KB and blogs) so the bot can answer how-to / procedural / configuration questions by citing the canonical product docs. Out of scope: any UI to embed the docs inline next to chat (deferred per the brainstorm; ship ingestion + tool first, decide on the panel based on real chat data).

## Non-goals

- A right-side iframe / embedded docs panel in the chat UI (deferred).
- Scheduled / cron-driven re-ingest (manual `npm run seed:docs` + admin Refresh button is v1).
- Surfacing docs candidates in the `<WrongAnswerModal>` (the fix path for docs is "edit the upstream docs repo", not "edit a DB row", so the existing KB-only candidate flow is correct).
- Federated search across KB + docs from one tool (they stay as separate tools the bot chooses between).

## Why now

After internal testing began, the team noticed two patterns:
1. The bot answers "how do I X" questions by improvising from KB entries that weren't written as procedural docs. Improvisations are often correct but cite KB rows that aren't really the right citation target.
2. The Dalgo docs site (`dalgot4d.github.io/dalgo_docs`) already exists, is well-structured (Docusaurus with named section anchors), and is what NGOs would land on if they Googled their own question.

Ingesting docs lets the bot send users directly to the canonical reference, with deep-links to the right section, and lets the docs team own that content via their existing GitHub workflow.

---

## Architecture

Three small subsystems, each modeled on existing precedent:

1. **Storage** — two new tables (`dalgo_docs_pages`, `dalgo_docs_chunks`) following the `dalgo_blog_articles` / `dalgo_blog_chunks` shape, with docs-specific fields (`tree`, `section_anchor`, `section_title`).
2. **Ingestion pipeline** — new `lib/docs/` directory mirroring the 8-module shape of `lib/blogs/`. A `scripts/seed-docs.ts` CLI entry plus an admin Refresh button trigger the same job.
3. **Retrieval surface** — a new `search_dalgo_docs` tool registered in `buildToolset(sessionId)`, plus two surgical prompt edits (added via the `/admin/prompts` UI, not via code) that teach the bot when to call it.

A new `docs-citations` eval bucket (6 cases) gates the feature's correctness.

---

## Component design

### 1. Schema

```sql
CREATE TABLE dalgo_docs_pages (
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
CREATE INDEX docs_pages_tree_idx     ON dalgo_docs_pages (tree);
CREATE INDEX docs_pages_category_idx ON dalgo_docs_pages (category);

CREATE TABLE dalgo_docs_chunks (
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
CREATE INDEX docs_chunks_embedding_idx ON dalgo_docs_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX docs_chunks_tsv_idx       ON dalgo_docs_chunks USING gin (tsv);
```

**Design notes:**

- **Two tables, not one.** Re-ingest idempotency: SHA-256 of the page markdown is checked against the stored `content_hash`; if unchanged, the page is skipped and no embeddings are regenerated (the expensive part of re-ingest). One table would either need per-chunk hashes (loses page-level dedupe — a typo causes every chunk to re-embed) or denormalized page metadata on every chunk row (~10× storage waste for title/category/content_md).
- **`tree` on page, not chunk.** The Docs vs Resources split is page-level. Filtering happens cheaply at the page level via the `docs_pages_tree_idx`.
- **`section_anchor` + `section_title` on chunk.** Chunk-level so the search result returns the deep-link target directly. Both NULL for the "intro" chunk (content before the first `<h2>`).
- **`contextual_text` vs `chunk_text`.** Same pattern as `dalgo_blog_chunks`: `chunk_text` is the raw section markdown; `contextual_text` is the Anthropic contextual-retrieval expansion (1-2 sentence page-context preamble) used both for embedding and for the lexical `tsv`. Improves retrieval on terse sections that don't have enough self-contained signal.
- **`ON DELETE CASCADE`** on `page_id`. Re-ingesting a changed page is `DELETE page → INSERT new page + chunks` in one transaction. Cascade does the chunk cleanup automatically.

**Migration:** `scripts/migrations/003_docs_corpus.sql` — idempotent `BEGIN/COMMIT` with `IF NOT EXISTS` guards. Same shape as the existing `001_prompts.sql` and `002_split_intro.sql`. Schema additions also go into `lib/db/schema.sql` so a fresh DB built from `schema.sql` alone gets them (the project's documented schema-drift discipline).

### 2. Ingestion pipeline

New `lib/docs/` directory, 8 modules mirroring `lib/blogs/`:

```
lib/docs/
├── types.ts            -- DocPage, DocChunk, ParsedPage, DocSection
├── indexer.ts          -- sitemap.xml → [{url, tree}]
├── fetcher.ts          -- HTTP GET + on-disk cache at .cache/docs/<sha1(url)>.html
├── parser.ts           -- Docusaurus HTML → ParsedPage
├── chunker.ts          -- ParsedPage → DocChunk[] (one per h2 section + intro)
├── contextualizer.ts   -- chunk + page context → contextual_text (LLM call)
├── upsert.ts           -- content-hash skip + transactional page/chunks upsert
└── ingest.ts           -- orchestrator
```

**Per-page flow:**

1. **Indexer**: GETs `https://dalgot4d.github.io/dalgo_docs/sitemap.xml` once, parses, returns `[{url, tree}]` where `tree` is `'docs'` or `'resources'` based on path substring (`/docs/` vs `/self-serve-documentation/`).
2. **Fetcher**: `GET <url>` with 24h on-disk cache. Cache key = URL. `--force` flag bypasses both the disk cache and the content-hash skip.
3. **Parser**: extracts:
   - `<h1>` text → `title`
   - `<meta name="description">` or first `<p>` of `<article>` → `description`
   - URL path segment after the tree (e.g., `/docs/charts/...` → `charts`) → `category`
   - `<article>.theme-doc-markdown` body → markdown via existing `turndown` dependency
   - Sections: walk all `<h2 class="anchor" id="...">` inside the article; each section spans heading-to-next-heading. Content before the first `<h2>` is the "intro" section (anchor = NULL, title = NULL).
4. **Chunker**: each `ParsedPage.sections[]` becomes one `DocChunk`. No splitting in v1; if a section is very long the embedding step still handles up to ~8K tokens. `chunk_index` is positional.
5. **Contextualizer**: same prompt-pattern as `lib/blogs/contextualizer.ts`. Input: full page markdown + this chunk's raw text. Output: 1-2 sentences situating the chunk for retrieval. Output is prepended to `chunk_text` to form `contextual_text`. Same OpenAI `text-embedding-3-small` @ 1536 dims for the final embed (used today by KB + blogs).
6. **Upsert**: per-page transaction:
   - `SELECT content_hash FROM dalgo_docs_pages WHERE url = $1`
   - If unchanged AND not `--force`: skip
   - Else: `BEGIN → DELETE FROM dalgo_docs_pages WHERE url = $1 → INSERT page → INSERT chunks → COMMIT`

**CLI entry**: `scripts/seed-docs.ts` (`npm run seed:docs`). Flags: `--force` (bypass disk cache + content-hash), `--tree docs|resources` (ingest one tree only), `--url <single-url>` (debug-mode single page).

### 3. Retrieval surface

#### `search_dalgo_docs` tool

New file `lib/llm/tools/search-dalgo-docs.ts`. Tool description string (visible to the LLM):

> Search the official Dalgo product documentation for how-to / procedural / configuration content. Use this when the user asks "how do I…", "where do I find…", or any product-usage question that a help article would answer. Returns up to 5 relevant doc sections with their canonical URL and section anchor — cite the URL in your reply, and if `section_anchor` is set, append `#<anchor>` so the user lands on the right section.

**Signature:**

```ts
search_dalgo_docs({
  query: string,
  tree?: 'docs' | 'resources',
  k?: number,
}): Promise<{
  results: Array<{
    page_url: string,
    section_anchor: string | null,
    section_title: string | null,
    page_title: string,
    tree: 'docs' | 'resources',
    snippet: string,    // first ~200 chars of chunk_text
    score: number,      // 0..1 cosine similarity
  }>
}>
```

`k` defaults to 5, capped at 10. `tree` defaults to both. The bot constructs the citation URL as `page_url + (section_anchor ? '#' + section_anchor : '')`.

#### Retrieval helpers

New `lib/db/queries/docs.ts`, mirroring the structure of `lib/db/queries/blogs.ts`:

- `vectorSearchDocs(query: string, k: number, treeFilter?: string)` — embeds query, runs `<=>` cosine search against `docs_chunks_embedding_idx`, returns rows joined with parent page metadata.
- `lexicalSearchDocs(query: string, k: number, treeFilter?: string)` — `ts_rank` against the `tsv` column.
- `hybridSearchDocs(query, k, treeFilter?)` — runs both, RRF-fuses them (k=60 constant, same as the existing blog hybrid), returns top-k.

The tool calls `hybridSearchDocs` directly. We do not extend `runPipeline()` to include docs candidates (the blog pipeline already mixes 3 sources; adding a 4th risks the rerank step becoming a bottleneck and dilutes the bot's ability to pick the right tool deliberately).

#### Telemetry

Two new event names: `docs_hit` (returned ≥1 result with score > 0.3) and `docs_miss` (top score ≤ 0.3 or zero results). Same threshold and emission pattern as the existing `kb_hit` / `kb_miss`.

#### Retrieval-trace integration

`messages.retrieval_trace.fused_top12` is the per-message debug snapshot. Docs candidates emit with `source: 'docs'` (parallel to existing `'kb_curated'`, `'pattern_curated'`, `'blog'`). The retrieval-debug panel renders them automatically (it iterates the raw trace). The wrong-answer modal's `parseCandidates` continues to filter only `source === 'kb_curated'` — a wrong docs answer is fixed by editing the upstream docs repo, not by editing a DB row, so surfacing docs candidates as fixable wouldn't have a useful action.

### 4. Prompt updates (via admin UI, not code)

Both edits land via the same SQL transaction pattern documented in `2026-05-26-admin-editable-prompts-design.md` (UPDATE the `dalgo_prompts` row + INSERT a `dalgo_prompt_versions` snapshot). The implementation plan will execute these as SQL during the rollout; future updates are then done by admins at `/admin/prompts`.

**Edit to `tools_inventory`** — add one bullet:
```
  • A way to look up official how-to / reference content from Dalgo's product docs (call search_dalgo_docs)
```

**Edit to `rules` — rule 9** — extend the existing tool-routing rule with a third sub-bullet:
```
9. **Three retrieval tools beyond search_dalgo_kb:**
   - call `search_dalgo_blogs` when the user mentions a specific tool (Kobo, DHIS2, ODK, Power BI), a sector (maternal health, education), or asks how other NGOs have approached something. Cite returned article URLs.
   - call `match_problem_pattern` when the user describes a *problem* in their own words ("we have no system", "data is everywhere") rather than asking a specific feature question. Use the returned consultant_framing and dalgo_response as the spine of your reply.
   - call `search_dalgo_docs` when the user asks "how do I…", "where do I find…", or any procedural / configuration question that an in-product help article would answer (creating charts, scheduling refreshes, managing users, setting up a connector). Cite the returned URL — if `section_anchor` is set, the bot's citation MUST include `#<anchor>` so the user lands on the right section.
```

No edits to `identity`, `consultant_mode`, `dalgo_vs_3rd_party`, or `fit_assessment`.

### 5. Admin UI (`/admin/docs`)

Mirrors `/admin/blogs` so the team gets a familiar surface.

**List page** (`app/admin/docs/page.tsx`):
- Server component, fetches directly via `query()` (matches `/admin/blogs/page.tsx` and `/admin/prompts/page.tsx`).
- Pages grouped by `tree` (Docs first, then Resources), then sub-grouped by `category`. Each row shows: page title (linked to `/admin/docs/[id]`), upstream URL (linked, opens in new tab with `rel="noopener noreferrer"`), category, last_fetched_at, chunk count.
- Top of page: a small client-rendered `<RefreshDocsButton>` component that POSTs to `/api/admin/docs/refresh` and shows a loading state.

**Detail page** (`app/admin/docs/[id]/page.tsx`):
- Page metadata header: title, upstream URL, tree, category, last_fetched_at, content_hash (truncated).
- Chunks list: for each chunk row, show `chunk_index`, `section_anchor` (with the full deep-link URL revealed on hover), `section_title`, the first ~300 chars of `contextual_text`.
- Read-only. Docs content is sourced from upstream; if the team needs to fix wording they edit the markdown in the `DalgoT4D/dalgo_docs` repo and trigger a Refresh.

**Refresh endpoint** (`app/api/admin/docs/refresh/route.ts`):
- POST, auth-gated via `await auth()` (matches every other `app/api/admin/*` route).
- Runs the ingest job synchronously in-request (~30-60s wall time). The button's loading state covers it. Returns `{ updated: N, unchanged: M, removed: K }`. If long-poll latency becomes a problem we can move to background-job execution later.

**Sidebar nav** (`app/admin/layout.tsx`):
- Add `Docs` link between `Blogs` and `Unanswered`.

No new shared components beyond `<RefreshDocsButton>`. Styling: plain Tailwind, slate text, simple cards — same aesthetic as the rest of `/admin`.

### 6. Eval coverage

New bucket `docs-citations`, 6 cases in `lib/llm/eval/cases/docs-citations.ts`:

| ID | Input | `must_cite_one_of` substrings |
|---|---|---|
| `dc-01` | "How do I create a chart in Dalgo?" | `['/docs/charts/']` |
| `dc-02` | "Where do I schedule a data refresh?" | `['/docs/data/']` |
| `dc-03` | "How do I share a dashboard with someone outside my org?" | `['/docs/dashboards/']` |
| `dc-04` | "I'm new — what's the fastest way to get my first report set up?" | `['/docs/quickstart/']` |
| `dc-05` | "What do you mean by 'connector' in Dalgo?" | `['/docs/concepts/glossary']` |
| `dc-06` | "Where do I add a new user to my workspace?" | `['/docs/settings/']` |

Cases conform to the existing `EvalCase` shape in `lib/llm/eval/cases/types.ts` (so no type changes are needed):

```ts
{
  id: 'dc-01',
  bucket: 'docs-citations',
  input: 'How do I create a chart in Dalgo?',
  expected: {
    must_cite_one_of: ['/docs/charts/'],
    must_not_hallucinate_urls: true,
  },
  judge: ['retrieval-judge', 'llm-judge', 'exact-match'],
}
```

How each case is verified:
- **exact-match judge** asserts the bot's reply contains one of the `must_cite_one_of` substrings.
- **`must_not_hallucinate_urls: true`** (existing field, enforced by `retrieval-judge`) ensures any URL in the reply was actually returned by a tool call this turn — so a passing case implies the bot called `search_dalgo_docs` (the only tool that returns `/docs/...` URLs). No new "must_call_tools" field needed.
- **llm-judge** (3-vote ensemble) checks the reply meaningfully answers the how-to and doesn't invent steps absent from the cited page.

Registered in `lib/llm/eval/runner.ts`'s `ALL` constant alongside existing buckets. No `EvalCase` schema changes required.

**Acceptance gate for the feature:** `docs-citations` ≥ 5/6 on initial run; total suite ≥ baseline (currently 41/50).

---

## Data flow

**At ingest time** (manual `npm run seed:docs` or admin Refresh button):

```
sitemap.xml
   │
   ▼
indexer ── [{url, tree}, ...] ──▶ for each:
                                     │
                                     ▼
                                  fetcher ── HTML (24h disk-cached)
                                     │
                                     ▼
                                  parser  ── ParsedPage { title, sections[] }
                                     │
                                     ▼
                                  chunker ── DocChunk[]
                                     │
                                     ▼
                                  contextualizer ── contextual_text per chunk (LLM call)
                                     │
                                     ▼
                                  upsert  ── content_hash check → skip OR transactional write
```

**At chat time**:

```
user message
   │
   ▼
LLM decides to call search_dalgo_docs (or not)
   │
   ▼
hybridSearchDocs(query, k=5)
   │
   ├─ vectorSearchDocs  ── pgvector cosine on docs_chunks_embedding_idx
   ├─ lexicalSearchDocs ── ts_rank on docs_chunks_tsv_idx
   └─ RRF fuse (k=60)
   │
   ▼
top-5 chunks joined with page metadata
   │
   ▼
LLM composes reply, cites page_url + #section_anchor
   │
   ▼
emit docs_hit / docs_miss telemetry + write to messages.retrieval_trace
```

---

## File map

```
NEW   lib/db/schema.sql                              (append Phase 5 block)
NEW   scripts/migrations/003_docs_corpus.sql        (idempotent BEGIN/COMMIT)

NEW   lib/docs/types.ts
NEW   lib/docs/indexer.ts
NEW   lib/docs/fetcher.ts
NEW   lib/docs/parser.ts
NEW   lib/docs/chunker.ts
NEW   lib/docs/contextualizer.ts
NEW   lib/docs/upsert.ts
NEW   lib/docs/ingest.ts
NEW   scripts/seed-docs.ts

NEW   lib/db/queries/docs.ts
NEW   lib/llm/tools/search-dalgo-docs.ts
EDIT  lib/llm/tools/index.ts                        (register search_dalgo_docs)

EDIT  package.json                                  (add "seed:docs" script)

NEW   app/admin/docs/page.tsx
NEW   app/admin/docs/[id]/page.tsx
NEW   app/api/admin/docs/refresh/route.ts
NEW   components/admin/refresh-docs-button.tsx
EDIT  app/admin/layout.tsx                          (add Docs link)

NEW   lib/llm/eval/cases/docs-citations.ts
EDIT  lib/llm/eval/runner.ts                        (add docsCitationsCases to ALL)

NEW   tests/lib/docs/parser.test.ts
NEW   tests/lib/docs/chunker.test.ts
NEW   tests/lib/docs/upsert.test.ts
NEW   tests/lib/db/docs.test.ts
NEW   tests/api/admin/docs-refresh.test.ts

EDIT  docs/JOURNAL.md                               (append shipping entry after eval re-run)
```

Two prompt edits (to `tools_inventory` and `rules`) land as SQL `UPDATE`s against `dalgo_prompts` + `INSERT`s into `dalgo_prompt_versions` — no source file change, since prompt content lives in the DB.

---

## Testing

**Unit tests:**
- `parser.test.ts` — fixture HTML (one page from the live docs, frozen to disk) → expected `ParsedPage` (title, description, category, sections with correct anchors and titles).
- `chunker.test.ts` — fixture `ParsedPage` → expected `DocChunk[]` (correct count, correct intro-chunk handling, correct section_anchor preservation).
- `upsert.test.ts` — content_hash unchanged → skip; content_hash changed → CASCADE delete + re-insert; verify chunk count after.

**Integration tests:**
- `tests/lib/db/docs.test.ts` — seed a fixture page, call `vectorSearchDocs("how to create a chart")`, assert top result is the seeded page with reasonable score.
- `tests/api/admin/docs-refresh.test.ts` — POST without auth → 401; POST with mocked auth → 200 with refresh stats shape; mock the ingest job to avoid hitting the live network.

**End-to-end:**
- The 6-case `docs-citations` eval bucket. Run `npm run eval:new` after ingest. Acceptance: ≥ 5/6.

No React component unit tests (project pattern: vitest is `environment: node`, no RTL — same constraint as the prompts feature). The two admin pages and one button get manual smoke during implementation.

---

## Rollout sequence

1. Schema migration + apply to local DB.
2. `lib/docs/` modules + `scripts/seed-docs.ts`.
3. Run `npm run seed:docs` against the live docs site. Verify row counts in psql.
4. `lib/db/queries/docs.ts` + `lib/llm/tools/search-dalgo-docs.ts` + tool registration.
5. Two prompt edits via SQL (with version snapshots).
6. Admin UI (`/admin/docs/`).
7. Eval cases + register in runner.
8. Run `npm run eval:new`. Assert `docs-citations` ≥ 5/6 and overall ≥ 41/50.
9. JOURNAL entry.

Each step is independently committable. No step blocks user-facing behavior until step 5 (prompt edits) tells the bot to use the new tool.

---

## Out of scope (deferred to future specs)

- **Right-side docs panel UI.** Render the cited docs page in an iframe next to the chat. Punted to a separate spec once we have real chat data showing whether NGOs actually click through doc links or whether the link alone is sufficient.
- **Scheduled re-ingest.** Vercel cron entry for nightly Refresh. Defer until manual + admin-button proves insufficient.
- **Per-section eval cases beyond the 6 starters.** Add bucket cases as the team finds questions the bot answers poorly.
- **`<WrongAnswerModal>` showing docs candidates.** Not actionable from the modal (fix path is upstream); leave the modal KB-only.
- **Federated KB+docs single tool.** Three tools that the bot picks between is more debuggable in the retrieval trace.

---

## Open risks

1. **Docusaurus class names could change in a future upstream version.** The parser depends on `<article>.theme-doc-markdown` and `<h2 class="anchor" id="...">`. Mitigation: snapshot a fixture HTML on first ingest and use it in `parser.test.ts`. If the upstream classes change later, the test fails loud before the next ingest is run in production.
2. **Sitemap might not cover every page.** Some Docusaurus configurations exclude certain pages. Mitigation: log the indexer's page count after each seed run; spot-check against the live sidebar manually on first ingest.
3. **Contextualizer cost.** ~150 pages × ~6 chunks/page = ~900 LLM calls per full re-ingest (when content_hash differs for all pages — rare). At Anthropic Sonnet rates this is ~$2-3 per full re-ingest. Incremental re-ingests (only changed pages) cost a fraction of that. Acceptable but worth flagging in the JOURNAL when first run.
4. **Two parallel doc trees could have overlapping content.** Documentation tab vs Resources tab. If they overlap substantially, the bot might return near-duplicate citations. Mitigation: spot-check on first ingest; if duplication is severe, add a deduplication step at upsert time (e.g., near-duplicate detection on `chunk_text`). Punt until observed.
