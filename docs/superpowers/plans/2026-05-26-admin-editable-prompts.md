# Admin-editable prompts + wrong-answer feedback loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the product team edit the bot's system prompt sections at `/admin/prompts` and flag wrong assistant answers at `/admin/conversations/[id]`, with both flows landing changes live within ~60 seconds and no redeploy.

**Architecture:** Split the current ~70-line `staticSystem()` into 5 DB-backed sections (`dalgo_prompts`), assembled at request time through an in-memory cache with 60s TTL + manual bust on save. Wrong-answer reports persist with a snapshot of the message's `retrieval_trace`, and the admin can fix the offending KB row inline using the existing `<KbEditor>` (made modal-friendly with a new `onSaved` prop) wrapped by a new 3-stage `<WrongAnswerModal>`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest (`environment: node`, no React Testing Library), raw `pg` Pool, NextAuth v5, Tailwind v4. Anthropic SDK via Vercel AI SDK v4 with `cacheControl: ephemeral`. Docker Postgres 16 + pgvector on host port 5436.

**Spec:** `docs/superpowers/specs/2026-05-26-admin-editable-prompts-design.md`

**Branch:** `feat/blog-ingestion` (continue commits on this branch; do NOT merge to main or push without explicit user instruction)

**Pre-flight expectations for the implementer:**
- The Postgres container `dalgo-discovery-db` is up (`docker compose up -d` if not). Apply migrations with `docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery < <file>`.
- `.env.local` exists with `DATABASE_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, NextAuth credentials. Tests load `.env.local` via `DOTENV_CONFIG_PATH`.
- **Do not run `npm run seed:kb`** — full re-seed costs ~$3 of embeddings. KB rows are only touched via the existing PATCH route which re-embeds the one row.
- Run a single test file: `npm test -- tests/lib/prompts.test.ts`
- Run all tests: `npm test`
- Tests connect to the live local Postgres. Each test file ends with `afterAll(async () => { await pool().end(); });` per the pattern in `tests/api/intake.test.ts`.

---

## Task 1: Schema + migration + seed for 3 new tables

**Files:**
- Modify: `lib/db/schema.sql` (append new section after the Phase 3 block at end)
- Create: `scripts/migrations/001_prompts.sql` (one-shot migration for the running container, with seed inserts pulling content from current `staticSystem()`)
- Test: `tests/lib/db/prompts-schema.test.ts`

The seed content is split out of the current `lib/llm/system-prompt.ts` `staticSystem()` function verbatim across 5 sections. Splitting is mechanical — no edits to wording.

- [ ] **Step 1: Write the failing schema test**

Create `tests/lib/db/prompts-schema.test.ts`:

```typescript
import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';

describe('dalgo_prompts schema', () => {
  it('has all 5 seed rows with non-empty content', async () => {
    const expectedKeys = [
      'intro_and_rules',
      'tools_inventory',
      'consultant_mode',
      'dalgo_vs_3rd_party',
      'fit_assessment',
    ];
    const { rows } = await query<{ key: string; content: string }>(
      `SELECT key, content FROM dalgo_prompts ORDER BY key`,
    );
    const keys = rows.map((r) => r.key).sort();
    expect(keys).toEqual([...expectedKeys].sort());
    for (const row of rows) {
      expect(row.content.length).toBeGreaterThan(20);
    }
  });

  it('seeded an initial version per prompt in dalgo_prompt_versions', async () => {
    const { rows } = await query<{ prompt_key: string; n: number }>(
      `SELECT prompt_key, COUNT(*)::int AS n
         FROM dalgo_prompt_versions
        GROUP BY prompt_key`,
    );
    expect(rows.length).toBe(5);
    for (const r of rows) {
      expect(r.n).toBeGreaterThanOrEqual(1);
    }
  });

  it('wrong_answer_reports table exists and accepts inserts', async () => {
    // Create a throwaway message to satisfy the FK
    const sess = await query<{ id: string }>(
      `INSERT INTO sessions DEFAULT VALUES RETURNING id`,
    );
    const msg = await query<{ id: string }>(
      `INSERT INTO messages (session_id, role, content)
       VALUES ($1, 'assistant', '{"text":"test"}'::jsonb) RETURNING id`,
      [sess.rows[0].id],
    );
    const r = await query<{ id: string }>(
      `INSERT INTO wrong_answer_reports (message_id, reason, retrieval_trace_snap, reported_by)
       VALUES ($1, 'test reason', '{}'::jsonb, 'test@dalgo.org') RETURNING id`,
      [msg.rows[0].id],
    );
    expect(r.rows[0].id).toBeTruthy();
    // cleanup
    await query(`DELETE FROM wrong_answer_reports WHERE id = $1`, [r.rows[0].id]);
    await query(`DELETE FROM messages WHERE id = $1`, [msg.rows[0].id]);
    await query(`DELETE FROM sessions WHERE id = $1`, [sess.rows[0].id]);
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- tests/lib/db/prompts-schema.test.ts`
Expected: FAIL with `relation "dalgo_prompts" does not exist` (or similar) on all three tests.

- [ ] **Step 3: Append schema to `lib/db/schema.sql`**

Append at the very end of the file (after the last `ALTER TABLE messages ADD COLUMN IF NOT EXISTS retrieval_trace jsonb;`):

```sql

-- ============================================================
-- Phase 4: Admin-editable prompts + wrong-answer reports (2026-05-26)
-- ============================================================

CREATE TABLE IF NOT EXISTS dalgo_prompts (
  key         text PRIMARY KEY,
  content     text NOT NULL,
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dalgo_prompt_versions (
  id          bigserial PRIMARY KEY,
  prompt_key  text NOT NULL REFERENCES dalgo_prompts(key) ON DELETE CASCADE,
  content     text NOT NULL,
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prompt_versions_key_idx
  ON dalgo_prompt_versions (prompt_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS wrong_answer_reports (
  id                   bigserial PRIMARY KEY,
  message_id           uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reason               text NOT NULL,
  retrieval_trace_snap jsonb,
  fixed_kb_id          uuid REFERENCES dalgo_knowledge_base(id) ON DELETE SET NULL,
  reported_by          text NOT NULL,
  reported_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wrong_answer_reports_msg_idx
  ON wrong_answer_reports (message_id);
```

- [ ] **Step 4: Create the one-shot migration with seed data**

Create directory if needed: `mkdir -p scripts/migrations`

Create `scripts/migrations/001_prompts.sql`. The seed `INSERT`s lift content verbatim from `lib/llm/system-prompt.ts`. Use PostgreSQL `$tag$ ... $tag$` dollar-quoting so we don't have to escape backticks/quotes/single-quotes inside the prompt text.

```sql
-- 001_prompts.sql — admin-editable prompts + wrong-answer reports
-- Apply with:
--   docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery \
--     < scripts/migrations/001_prompts.sql

BEGIN;

CREATE TABLE IF NOT EXISTS dalgo_prompts (
  key         text PRIMARY KEY,
  content     text NOT NULL,
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dalgo_prompt_versions (
  id          bigserial PRIMARY KEY,
  prompt_key  text NOT NULL REFERENCES dalgo_prompts(key) ON DELETE CASCADE,
  content     text NOT NULL,
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prompt_versions_key_idx
  ON dalgo_prompt_versions (prompt_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS wrong_answer_reports (
  id                   bigserial PRIMARY KEY,
  message_id           uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reason               text NOT NULL,
  retrieval_trace_snap jsonb,
  fixed_kb_id          uuid REFERENCES dalgo_knowledge_base(id) ON DELETE SET NULL,
  reported_by          text NOT NULL,
  reported_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wrong_answer_reports_msg_idx
  ON wrong_answer_reports (message_id);

-- Seed the 5 prompt sections (idempotent: ON CONFLICT DO NOTHING).
-- Content is split verbatim from lib/llm/system-prompt.ts staticSystem().

INSERT INTO dalgo_prompts (key, content, updated_by) VALUES
('intro_and_rules', $prompt$You are the Dalgo Discovery Assistant. You help NGO leaders understand whether Dalgo — a data platform built for NGOs by Tech4Dev — fits their needs.

Rules:
1. Ground every capability claim by calling search_dalgo_kb. Cite the KB entry by paraphrasing its content; do not invent capabilities.
2. If the KB says "no", "partial", or "roadmap" — say so honestly. Suggest genuine workarounds where they exist.
3. Connect NGO context to Dalgo: "Since you use <X>, here's how Dalgo would..."
4. Never invent connectors, chart types, or features not present in the KB.
5. If asked something outside Dalgo's scope, be helpful briefly, then redirect to Dalgo fit.
6. Soft CTA every 3–4 turns (offer demo, personalized PDF report).
7. Detect deal-breakers early and surface them honestly.
8. **At the end of nearly every reply, call suggest_replies with 2-4 short suggested next replies.** These should be follow-up questions or clarifications the user is likely to want next. Phrase them from the user's perspective ("I use X", "Yes, tell me more", "What about pricing?"). Skip suggest_replies only when the conversation has clearly ended (user said goodbye, or after request_demo).
9. **Two new tools are available:**
   - call `search_dalgo_blogs` when the user mentions a specific tool (Kobo, DHIS2, ODK, Power BI), a sector (maternal health, education), or asks how other NGOs have approached something. Cite returned article URLs.
   - call `match_problem_pattern` when the user describes a *problem* in their own words ("we have no system", "data is everywhere") rather than asking a specific feature question. Use the returned consultant_framing and dalgo_response as the spine of your reply.

10. **Citation discipline: every URL in your reply MUST have come from a tool result on this turn.** Never invent URLs, customer names, or capabilities. If you don't have a relevant citation, say: "I don't have a specific case study for this — would you like me to flag it for the Dalgo team to share one?" Faking a connection (claiming Bhumi/SHRI/STiR/etc. did something they didn't) is the single worst failure mode for this bot — refuse it absolutely.$prompt$, 'seed'),

('tools_inventory', $prompt$You have:
  • A knowledge base of Dalgo's exact capabilities (call search_dalgo_kb)
  • Tools to learn about the NGO (fetch_ngo_website, parse_pdf)
  • A way to capture interest (request_demo)
  • A way to offer the user clickable next-step suggestions (suggest_replies)$prompt$, 'seed'),

('consultant_mode', $prompt$## Consultant mode (for problem statements)

When the user describes a problem (rather than asking a specific feature question), do not jump to a feature list. First:
  1. Call `match_problem_pattern` with their phrasing.
  2. Call `search_dalgo_blogs` to find a customer who has been in their shoes.

Then respond in 2-3 parts:
  - **Reframe** what they're really facing in 1–2 sentences of consultant language.
  - **Explain** how Dalgo (product + Dalgo's data team) addresses it — name actual capabilities.
  - **Cite a customer ONLY if retrieval surfaced a clean match** (a pattern_curated entry with relevant evidence_urls, or a blog chunk that genuinely describes a similar NGO situation). Quote a 1–2 sentence snippet and the link.
  - **If no clean match exists, say so explicitly:** "I don't have a specific case study for this — would you like me to flag it for the Dalgo team to share one?" Then answer from KB / product knowledge and stop.$prompt$, 'seed'),

('dalgo_vs_3rd_party', $prompt$## Hard boundary: Dalgo vs integrated 3rd-party tools

Dalgo's actual product surface is: connectors, ingestion into the NGO's warehouse, dbt transformations, Prefect orchestration, Dalgo's native UI (admin, ingest config, dbt editor, native dashboard builder with 6 chart types — bar/line/pie/KPI/table/map), native sharing/embedding, workspace-level RBAC, and Dalgo consulting.

Features in Superset, Power BI, Looker, Tableau, or Airbyte (as a component) are NOT Dalgo features — they belong to those products. Dalgo can host the Superset add-on for ₹48,000/year extra, but the FEATURES are still Superset's, not Dalgo's.

When asked "does Dalgo do X?":
- If X is a Dalgo-native feature → answer Yes with the native capability.
- If X belongs to a 3rd-party tool (RLS, 40+ chart types, etc.) → answer honestly: "X isn't a Dalgo feature. <Tool> provides it. NGOs that need it run <Tool> alongside Dalgo, often as the optional Superset add-on."
- Never attribute a 3rd-party feature to Dalgo, even with hedging.

**Default reply shape for product questions:** "Yes, in Dalgo you can [native feature]. If you need [advanced thing not in Dalgo native], you can also point a 3rd-party tool like Superset or Looker at your Dalgo warehouse — that's how [NGO X] does it [link]."

**Comparison tables — strict cell-level grounding:** Every cell in a comparison table is a separate factual claim. Each cell must come from KB content, not from "what would make this column look parallel." If you can't ground a cell, write "check with Dalgo team" or omit the row entirely. Never fabricate a cell to fill the grid.

**Pricing facts to never confuse:**
- Dalgo base Data Platform: ₹2,04,000/year (ingestion + transformation + orchestration + Dalgo support)
- Superset add-on: ₹48,000/year ON TOP of the base — NOT included
- Setup/onboarding: ₹2,500/hour, separate$prompt$, 'seed'),

('fit_assessment', $prompt$## Fit Assessment Mode

If the user asks for a fit assessment, says they don't know what to ask, or clicks the "Help me figure out if Dalgo fits us" button, switch into Fit Assessment Mode:

  - Ask ONE question at a time about their organization (team size, current data systems, main use case, technical comfort, hosting needs, etc.).
  - For each question, call suggest_replies with 3-4 multiple-choice answer options the user can click.
  - Keep questions short and conversational. Don't recite a survey.
  - After 5-6 exchanges, give a concise **Fit Verdict** with:
      - **What fits well** for their NGO
      - **Potential challenges** or gaps (be honest about "no"/"partial" KB items)
      - **Recommended next step** (e.g., book demo, try free trial, talk to sales)
  - Use search_dalgo_kb at least 2-3 times during the assessment to ground your verdict.$prompt$, 'seed')
ON CONFLICT (key) DO NOTHING;

-- Mirror each seeded row into the version history so v1 isn't empty
INSERT INTO dalgo_prompt_versions (prompt_key, content, updated_by, updated_at)
SELECT key, content, updated_by, updated_at
  FROM dalgo_prompts
 WHERE NOT EXISTS (
   SELECT 1 FROM dalgo_prompt_versions v WHERE v.prompt_key = dalgo_prompts.key
 );

COMMIT;
```

- [ ] **Step 5: Apply the migration to the running Postgres container**

Confirm the container is up first:

```bash
docker ps --filter name=dalgo-discovery-db --format '{{.Status}}'
```

Expected: a line starting with `Up`. If empty, run `docker compose up -d`.

Apply the migration:

```bash
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery \
  < scripts/migrations/001_prompts.sql
```

Expected output ends with `COMMIT` and shows the three `CREATE TABLE`, two `CREATE INDEX`, and two `INSERT 0 N` rows (N = 5 for both inserts on first run).

- [ ] **Step 6: Re-run the schema test to verify pass**

Run: `npm test -- tests/lib/db/prompts-schema.test.ts`
Expected: PASS, all 3 tests green.

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema.sql scripts/migrations/001_prompts.sql tests/lib/db/prompts-schema.test.ts
git commit -m "$(cat <<'EOF'
feat(db): admin-editable prompts + wrong-answer reports schema

Three new tables: dalgo_prompts (5 seeded sections), dalgo_prompt_versions
(append-only history), wrong_answer_reports. Migration seeds prompt content
verbatim from current staticSystem() so behavior is unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `lib/llm/prompts.ts` — cache + invalidation

**Files:**
- Create: `lib/llm/prompts.ts`
- Test: `tests/lib/prompts.test.ts`

This is a pure module — no Next.js, no auth. The cache lives in module scope (one cache per Node.js process), TTL is 60 seconds, manual invalidation bumps a counter for debug visibility and clears entries.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/prompts.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';
import {
  getPrompt,
  invalidatePromptCache,
  __resetForTests,
  __cacheStatsForTests,
} from '@/lib/llm/prompts';

describe('getPrompt', () => {
  beforeEach(() => {
    __resetForTests();
    vi.useRealTimers();
  });

  it('fetches from the DB on first call', async () => {
    const content = await getPrompt('intro_and_rules');
    expect(content.length).toBeGreaterThan(20);
    expect(__cacheStatsForTests().size).toBe(1);
  });

  it('serves from cache within TTL', async () => {
    await getPrompt('intro_and_rules');
    const statsBefore = __cacheStatsForTests();
    await getPrompt('intro_and_rules');
    const statsAfter = __cacheStatsForTests();
    expect(statsAfter.size).toBe(1);
    expect(statsAfter.lastFetchedAt).toBe(statsBefore.lastFetchedAt);
  });

  it('refetches after TTL expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T10:00:00Z'));
    await getPrompt('intro_and_rules');
    const firstFetched = __cacheStatsForTests().lastFetchedAt;

    vi.setSystemTime(new Date('2026-05-26T10:01:01Z')); // +61s
    await getPrompt('intro_and_rules');
    const secondFetched = __cacheStatsForTests().lastFetchedAt;

    expect(secondFetched).toBeGreaterThan(firstFetched);
  });

  it('throws on missing key', async () => {
    await expect(getPrompt('does_not_exist')).rejects.toThrow(
      /not found in dalgo_prompts/,
    );
  });

  it('invalidatePromptCache(key) clears that one entry', async () => {
    await getPrompt('intro_and_rules');
    await getPrompt('fit_assessment');
    expect(__cacheStatsForTests().size).toBe(2);
    invalidatePromptCache('intro_and_rules');
    expect(__cacheStatsForTests().size).toBe(1);
  });

  it('invalidatePromptCache() with no key clears all', async () => {
    await getPrompt('intro_and_rules');
    await getPrompt('fit_assessment');
    invalidatePromptCache();
    expect(__cacheStatsForTests().size).toBe(0);
  });

  it('invalidatePromptCache bumps version counter', async () => {
    const v0 = __cacheStatsForTests().version;
    invalidatePromptCache('intro_and_rules');
    expect(__cacheStatsForTests().version).toBe(v0 + 1);
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/prompts.test.ts`
Expected: FAIL with `Cannot find module '@/lib/llm/prompts'` or similar.

- [ ] **Step 3: Write the implementation**

Create `lib/llm/prompts.ts`:

```typescript
import { query } from '@/lib/db/client';

const TTL_MS = 60_000;

type CacheEntry = { content: string; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
let version = 0;
let lastFetchedAt = 0;

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
  lastFetchedAt = fetchedAt;
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
  lastFetchedAt = 0;
}

export function __cacheStatsForTests(): {
  size: number;
  version: number;
  lastFetchedAt: number;
} {
  return { size: cache.size, version, lastFetchedAt };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/prompts.test.ts`
Expected: PASS, all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/prompts.ts tests/lib/prompts.test.ts
git commit -m "$(cat <<'EOF'
feat(prompts): getPrompt cache helper with 60s TTL + manual bust

In-memory module-level cache. invalidatePromptCache(key?) clears entries
and bumps a version counter for debug correlation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Refactor `staticSystem()` to async, fix callers

**Files:**
- Modify: `lib/llm/system-prompt.ts`
- Modify: `app/api/chat/route.ts` (line 114 area)
- Modify: `lib/llm/eval/runner.ts` (lines 64 and 154)

The current `staticSystem()` is synchronous and returns a hardcoded string. After this task, it assembles from `getPrompt()` in parallel. `buildSystemPrompt()` becomes async too.

- [ ] **Step 1: Write a failing test for the new async behavior**

Create `tests/lib/system-prompt.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';
import { staticSystem, buildSystemPrompt } from '@/lib/llm/system-prompt';
import { __resetForTests } from '@/lib/llm/prompts';

describe('staticSystem (async, DB-backed)', () => {
  beforeEach(() => __resetForTests());

  it('returns a Promise<string> that includes all 5 sections joined', async () => {
    const result = staticSystem();
    expect(result).toBeInstanceOf(Promise);
    const text = await result;
    // Sanity: pulls from seeded content
    expect(text).toContain('Dalgo Discovery Assistant');         // intro_and_rules
    expect(text).toContain('search_dalgo_kb');                    // tools_inventory
    expect(text).toContain('Consultant mode');                    // consultant_mode
    expect(text).toContain('Hard boundary');                      // dalgo_vs_3rd_party
    expect(text).toContain('Fit Assessment Mode');                // fit_assessment
  });

  it('reflects DB edits on the next call after invalidation', async () => {
    const { invalidatePromptCache } = await import('@/lib/llm/prompts');
    const original = await query<{ content: string }>(
      `SELECT content FROM dalgo_prompts WHERE key = 'intro_and_rules'`,
    );
    try {
      await query(
        `UPDATE dalgo_prompts SET content = $1, updated_by = 'test', updated_at = now()
          WHERE key = 'intro_and_rules'`,
        ['MUTATED_FOR_TEST'],
      );
      invalidatePromptCache('intro_and_rules');
      const text = await staticSystem();
      expect(text).toContain('MUTATED_FOR_TEST');
    } finally {
      await query(
        `UPDATE dalgo_prompts SET content = $1 WHERE key = 'intro_and_rules'`,
        [original.rows[0].content],
      );
      invalidatePromptCache('intro_and_rules');
    }
  });

  it('buildSystemPrompt appends NGO context block', async () => {
    const text = await buildSystemPrompt({
      ngo_summary: 'A health NGO.',
      ngo_systems: 'KoboToolbox',
      data_types: ['enrollment'],
    });
    expect(text).toContain('A health NGO.');
    expect(text).toContain('KoboToolbox');
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- tests/lib/system-prompt.test.ts`
Expected: FAIL on the first assertion (`result` is currently a `string`, not a `Promise`).

- [ ] **Step 3: Rewrite `lib/llm/system-prompt.ts`**

Replace the entire file contents with:

```typescript
import { getPrompt } from '@/lib/llm/prompts';

export async function staticSystem(): Promise<string> {
  const [intro, tools, consultant, boundary, fit] = await Promise.all([
    getPrompt('intro_and_rules'),
    getPrompt('tools_inventory'),
    getPrompt('consultant_mode'),
    getPrompt('dalgo_vs_3rd_party'),
    getPrompt('fit_assessment'),
  ]);
  return [intro, tools, consultant, boundary, fit].join('\n\n');
}

export function ngoContextBlock(opts: {
  ngo_summary?: string | null;
  ngo_systems?: string | null;
  data_types?: string[] | null;
}): string {
  const lines = [
    opts.ngo_summary ? `NGO summary (from their website): ${opts.ngo_summary}` : null,
    opts.ngo_systems ? `Systems they use today: ${opts.ngo_systems}` : null,
    opts.data_types?.length ? `Data they work with: ${opts.data_types.join(', ')}` : null,
  ].filter(Boolean);
  return lines.length ? `NGO context:\n${lines.join('\n')}` : '';
}

export async function buildSystemPrompt(
  opts: Parameters<typeof ngoContextBlock>[0],
): Promise<string> {
  const [staticPart, ngo] = await Promise.all([
    staticSystem(),
    Promise.resolve(ngoContextBlock(opts)),
  ]);
  return ngo ? `${staticPart}\n\n${ngo}` : staticPart;
}
```

- [ ] **Step 4: Fix the chat route caller**

Open `app/api/chat/route.ts` and find line 114 (the `content: staticSystem(),` reference). Change it to `await` the call. The surrounding handler is already `async` so this is a one-character change pattern:

```typescript
// before
content: staticSystem(),

// after
content: await staticSystem(),
```

Confirm with: `grep -n "staticSystem" app/api/chat/route.ts` — should still show the call site, now with `await`.

- [ ] **Step 5: Fix the eval runner**

Open `lib/llm/eval/runner.ts`. Two call sites:

**Line ~64** (inside `buildSystemPrompt({...})` call):

```typescript
// before
system: buildSystemPrompt({...}),

// after — buildSystemPrompt is now async
system: await buildSystemPrompt({...}),
```

The surrounding function is already async (it uses `await` elsewhere); confirm by grepping `async function` near that line.

**Line ~154** (the augmented prompt template):

```typescript
// before
const augmented = `${staticSystem()}\n\n## Retrieved context...`;

// after
const augmented = `${await staticSystem()}\n\n## Retrieved context...`;
```

Same async-context requirement — the surrounding function should already be async. If TypeScript complains that the surrounding function isn't async, mark it `async` and add `Promise<...>` to its return type.

- [ ] **Step 6: Run the new test + the existing full suite**

```bash
npm test -- tests/lib/system-prompt.test.ts
npm test
```

Expected: the new file passes; the rest of the suite still passes. If any test broke, it's almost certainly a missed `await staticSystem()` somewhere — grep `grep -rn "staticSystem\|buildSystemPrompt" lib/ app/ tests/ scripts/` and audit each call site.

- [ ] **Step 7: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. If there are errors about `Promise<string>` not assignable to `string`, those are call sites that need an `await`.

- [ ] **Step 8: Commit**

```bash
git add lib/llm/system-prompt.ts app/api/chat/route.ts lib/llm/eval/runner.ts tests/lib/system-prompt.test.ts
git commit -m "$(cat <<'EOF'
refactor(prompts): staticSystem() assembles from DB via getPrompt

Splits the hardcoded 70-line prompt into 5 DB-backed sections fetched in
parallel and joined. buildSystemPrompt becomes async too. Chat route and
eval runner updated to await.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Admin API — prompts CRUD

**Files:**
- Create: `app/api/admin/prompts/route.ts` (GET list)
- Create: `app/api/admin/prompts/[key]/route.ts` (GET one, PUT update)
- Create: `app/api/admin/prompts/[key]/versions/route.ts` (GET version history)
- Test: `tests/api/admin/prompts.test.ts`

Auth pattern matches existing `app/api/admin/kb/[id]/route.ts`: `const session = await auth(); if (!session?.user) return 401`.

- [ ] **Step 1: Write the failing tests**

Create `tests/api/admin/prompts.test.ts`:

```typescript
import { describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';

// Mock the auth helper used by admin routes
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => ({ user: { email: 'test@dalgo.org' } })),
}));

import { GET as listGet } from '@/app/api/admin/prompts/route';
import { GET as oneGet, PUT as onePut } from '@/app/api/admin/prompts/[key]/route';
import { GET as versionsGet } from '@/app/api/admin/prompts/[key]/versions/route';

function req(url: string, init?: RequestInit): any {
  return new Request(url, init);
}

describe('GET /api/admin/prompts', () => {
  it('returns all 5 prompts', async () => {
    const res = await listGet(req('http://t/api/admin/prompts') as any);
    const json = await res.json();
    expect(json.items.length).toBe(5);
    expect(json.items[0]).toHaveProperty('key');
    expect(json.items[0]).toHaveProperty('content');
    expect(json.items[0]).toHaveProperty('updated_at');
  });
});

describe('GET /api/admin/prompts/[key]', () => {
  it('returns one prompt', async () => {
    const res = await oneGet(req('http://t/api/admin/prompts/intro_and_rules') as any, {
      params: Promise.resolve({ key: 'intro_and_rules' }),
    });
    const json = await res.json();
    expect(json.item.key).toBe('intro_and_rules');
    expect(json.item.content).toContain('Dalgo Discovery Assistant');
  });

  it('returns 404 for unknown key', async () => {
    const res = await oneGet(req('http://t/api/admin/prompts/nope') as any, {
      params: Promise.resolve({ key: 'nope' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/admin/prompts/[key]', () => {
  let originalContent: string;

  beforeEach(async () => {
    const { rows } = await query<{ content: string }>(
      `SELECT content FROM dalgo_prompts WHERE key = 'tools_inventory'`,
    );
    originalContent = rows[0].content;
  });

  it('updates the prompt AND appends a version row in one transaction', async () => {
    const versionsBefore = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM dalgo_prompt_versions WHERE prompt_key = 'tools_inventory'`,
    );

    const res = await onePut(
      req('http://t/api/admin/prompts/tools_inventory', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'updated-by-test' }),
      }) as any,
      { params: Promise.resolve({ key: 'tools_inventory' }) },
    );
    const json = await res.json();
    expect(json.item.content).toBe('updated-by-test');
    expect(json.item.updated_by).toBe('test@dalgo.org');

    const versionsAfter = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM dalgo_prompt_versions WHERE prompt_key = 'tools_inventory'`,
    );
    expect(versionsAfter.rows[0].n).toBe(versionsBefore.rows[0].n + 1);

    // cleanup
    await query(`UPDATE dalgo_prompts SET content = $1 WHERE key = 'tools_inventory'`, [originalContent]);
  });

  it('returns 400 for invalid body', async () => {
    const res = await onePut(
      req('http://t/api/admin/prompts/tools_inventory', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wrong_field: 'x' }),
      }) as any,
      { params: Promise.resolve({ key: 'tools_inventory' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown key', async () => {
    const res = await onePut(
      req('http://t/api/admin/prompts/nope', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'x' }),
      }) as any,
      { params: Promise.resolve({ key: 'nope' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('GET /api/admin/prompts/[key]/versions', () => {
  it('returns history descending by updated_at', async () => {
    const res = await versionsGet(
      req('http://t/api/admin/prompts/intro_and_rules/versions') as any,
      { params: Promise.resolve({ key: 'intro_and_rules' }) },
    );
    const json = await res.json();
    expect(Array.isArray(json.versions)).toBe(true);
    expect(json.versions.length).toBeGreaterThanOrEqual(1);
    // assert desc order
    for (let i = 1; i < json.versions.length; i++) {
      const prev = new Date(json.versions[i - 1].updated_at).getTime();
      const cur = new Date(json.versions[i].updated_at).getTime();
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });
});

afterAll(async () => { await pool().end(); });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin/prompts.test.ts`
Expected: FAIL with `Cannot find module '@/app/api/admin/prompts/route'`.

- [ ] **Step 3: Implement `app/api/admin/prompts/route.ts` (list)**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { rows } = await query<{
    key: string;
    content: string;
    updated_by: string;
    updated_at: string;
  }>(
    `SELECT key, content, updated_by, updated_at
       FROM dalgo_prompts
       ORDER BY key`,
  );
  return NextResponse.json({ items: rows });
}
```

- [ ] **Step 4: Implement `app/api/admin/prompts/[key]/route.ts` (GET one + PUT update)**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { pool, query } from '@/lib/db/client';
import { invalidatePromptCache } from '@/lib/llm/prompts';
import { z } from 'zod';

const PutBody = z.object({ content: z.string().min(1) });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { key } = await params;

  const { rows } = await query(
    `SELECT key, content, updated_by, updated_at FROM dalgo_prompts WHERE key = $1`,
    [key],
  );
  if (!rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ item: rows[0] });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { key } = await params;

  let body: { content: string };
  try {
    body = PutBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'invalid body', detail: String(e) }, { status: 400 });
  }

  const email = session.user.email ?? 'unknown';

  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query<{
      key: string;
      content: string;
      updated_by: string;
      updated_at: string;
    }>(
      `UPDATE dalgo_prompts
          SET content = $1, updated_by = $2, updated_at = now()
        WHERE key = $3
        RETURNING key, content, updated_by, updated_at`,
      [body.content, email, key],
    );
    if (!upd.rows[0]) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    await client.query(
      `INSERT INTO dalgo_prompt_versions (prompt_key, content, updated_by, updated_at)
       VALUES ($1, $2, $3, $4)`,
      [key, upd.rows[0].content, upd.rows[0].updated_by, upd.rows[0].updated_at],
    );
    await client.query('COMMIT');
    invalidatePromptCache(key);
    return NextResponse.json({ item: upd.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 5: Implement `app/api/admin/prompts/[key]/versions/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { key } = await params;

  const { rows } = await query(
    `SELECT id, prompt_key, content, updated_by, updated_at
       FROM dalgo_prompt_versions
      WHERE prompt_key = $1
      ORDER BY updated_at DESC`,
    [key],
  );
  return NextResponse.json({ versions: rows });
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- tests/api/admin/prompts.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/prompts tests/api/admin/prompts.test.ts
git commit -m "$(cat <<'EOF'
feat(api/admin): prompts CRUD with versioned history

GET list, GET one, PUT (transactional update + version insert + cache bust),
GET versions desc. All gated by NextAuth admin session.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Admin API — wrong-answer reports

**Files:**
- Create: `app/api/admin/wrong-answers/route.ts` (POST create + parse candidates)
- Create: `app/api/admin/wrong-answers/[id]/route.ts` (PATCH set fixed_kb_id)
- Test: `tests/api/admin/wrong-answers.test.ts`

Candidate parsing: from `messages.retrieval_trace`, take `fused_top12` filtered to `source === 'kb'`, take top 5, join to `dalgo_knowledge_base` by id to fetch the first question variant and a ~140-char snippet of `canonical_answer`.

- [ ] **Step 1: Write the failing tests**

Create `tests/api/admin/wrong-answers.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => ({ user: { email: 'test@dalgo.org' } })),
}));

import { POST as createPost } from '@/app/api/admin/wrong-answers/route';
import { PATCH as updatePatch } from '@/app/api/admin/wrong-answers/[id]/route';

function req(url: string, init?: RequestInit): any {
  return new Request(url, init);
}

describe('POST /api/admin/wrong-answers', () => {
  let sessionId: string;
  let messageId: string;
  let kbId: string;

  beforeAll(async () => {
    // grab a real KB id to embed in the trace
    const { rows: kb } = await query<{ id: string }>(
      `SELECT id FROM dalgo_knowledge_base LIMIT 1`,
    );
    kbId = kb[0].id;

    const { rows: s } = await query<{ id: string }>(`INSERT INTO sessions DEFAULT VALUES RETURNING id`);
    sessionId = s[0].id;

    const trace = {
      hyde: 'h',
      candidates: { kb: [{ id: kbId, preview: 'p' }], patterns: [], blogs: [] },
      fused_top12: [
        { id: kbId, score: 0.9, source: 'kb', preview: 'top kb candidate' },
        { id: 'fake-pattern-id', score: 0.5, source: 'pattern', preview: 'pat' },
      ],
      rerank_scores: [],
      final_context_ids: [kbId],
    };
    const { rows: m } = await query<{ id: string }>(
      `INSERT INTO messages (session_id, role, content, retrieval_trace)
       VALUES ($1, 'assistant', '{"text":"the bad answer"}'::jsonb, $2::jsonb)
       RETURNING id`,
      [sessionId, JSON.stringify(trace)],
    );
    messageId = m[0].id;
  });

  it('creates a report, snapshots the trace, and returns parsed KB candidates', async () => {
    const res = await createPost(
      req('http://t/api/admin/wrong-answers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, reason: 'fabricated detail' }),
      }) as any,
    );
    const json = await res.json();
    expect(json.id).toBeTruthy();
    expect(Array.isArray(json.candidates)).toBe(true);
    expect(json.candidates.length).toBe(1); // only the kb-source candidate
    expect(json.candidates[0].kb_id).toBe(kbId);
    expect(json.candidates[0].score).toBe(0.9);
    expect(typeof json.candidates[0].question).toBe('string');
    expect(typeof json.candidates[0].snippet).toBe('string');

    // verify snapshot is persisted
    const { rows } = await query<{ retrieval_trace_snap: any }>(
      `SELECT retrieval_trace_snap FROM wrong_answer_reports WHERE id = $1`,
      [json.id],
    );
    expect(rows[0].retrieval_trace_snap.fused_top12).toBeTruthy();
  });

  it('handles messages without a trace by returning empty candidates', async () => {
    const { rows: noTrace } = await query<{ id: string }>(
      `INSERT INTO messages (session_id, role, content)
       VALUES ($1, 'assistant', '{"text":"old msg"}'::jsonb) RETURNING id`,
      [sessionId],
    );
    const res = await createPost(
      req('http://t/api/admin/wrong-answers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message_id: noTrace[0].id, reason: 'no trace' }),
      }) as any,
    );
    const json = await res.json();
    expect(json.candidates).toEqual([]);
  });
});

describe('PATCH /api/admin/wrong-answers/[id]', () => {
  it('sets fixed_kb_id', async () => {
    // Reuse the most recent report
    const { rows: report } = await query<{ id: string }>(
      `SELECT id FROM wrong_answer_reports ORDER BY reported_at DESC LIMIT 1`,
    );
    const { rows: kb } = await query<{ id: string }>(
      `SELECT id FROM dalgo_knowledge_base LIMIT 1`,
    );
    const res = await updatePatch(
      req(`http://t/api/admin/wrong-answers/${report[0].id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fixed_kb_id: kb[0].id }),
      }) as any,
      { params: Promise.resolve({ id: report[0].id }) },
    );
    expect(res.status).toBe(200);
    const { rows } = await query<{ fixed_kb_id: string }>(
      `SELECT fixed_kb_id FROM wrong_answer_reports WHERE id = $1`,
      [report[0].id],
    );
    expect(rows[0].fixed_kb_id).toBe(kb[0].id);
  });
});

afterAll(async () => { await pool().end(); });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin/wrong-answers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/api/admin/wrong-answers/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';
import { z } from 'zod';

const CreateBody = z.object({
  message_id: z.string().uuid(),
  reason: z.string().min(1),
});

type Trace = {
  fused_top12?: Array<{ id: string; score: number; source: string; preview?: string }>;
};

type Candidate = {
  kb_id: string;
  question: string;
  snippet: string;
  score: number;
};

async function parseCandidates(trace: Trace | null): Promise<Candidate[]> {
  if (!trace?.fused_top12) return [];
  const kbCandidates = trace.fused_top12.filter((c) => c.source === 'kb').slice(0, 5);
  if (kbCandidates.length === 0) return [];
  const ids = kbCandidates.map((c) => c.id);
  const { rows } = await query<{ id: string; question_variants: string[]; canonical_answer: string }>(
    `SELECT id, question_variants, canonical_answer
       FROM dalgo_knowledge_base
      WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return kbCandidates
    .map((c) => {
      const row = byId.get(c.id);
      if (!row) return null;
      return {
        kb_id: c.id,
        question: row.question_variants?.[0] ?? '(no question variant)',
        snippet: (row.canonical_answer ?? '').slice(0, 140),
        score: c.score,
      };
    })
    .filter((x): x is Candidate => x !== null);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { message_id: string; reason: string };
  try {
    body = CreateBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'invalid body', detail: String(e) }, { status: 400 });
  }

  const { rows: msg } = await query<{ retrieval_trace: Trace | null }>(
    `SELECT retrieval_trace FROM messages WHERE id = $1`,
    [body.message_id],
  );
  if (!msg[0]) return NextResponse.json({ error: 'message not found' }, { status: 404 });

  const trace = msg[0].retrieval_trace;
  const email = session.user.email ?? 'unknown';
  const { rows } = await query<{ id: string }>(
    `INSERT INTO wrong_answer_reports
       (message_id, reason, retrieval_trace_snap, reported_by)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING id`,
    [body.message_id, body.reason, trace ? JSON.stringify(trace) : null, email],
  );

  const candidates = await parseCandidates(trace);
  return NextResponse.json({ id: rows[0].id, candidates });
}
```

- [ ] **Step 4: Implement `app/api/admin/wrong-answers/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';
import { z } from 'zod';

const PatchBody = z.object({ fixed_kb_id: z.string().uuid() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  let body: { fixed_kb_id: string };
  try {
    body = PatchBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'invalid body', detail: String(e) }, { status: 400 });
  }

  const { rows } = await query(
    `UPDATE wrong_answer_reports SET fixed_kb_id = $1 WHERE id = $2 RETURNING id`,
    [body.fixed_kb_id, id],
  );
  if (!rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/api/admin/wrong-answers.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/wrong-answers tests/api/admin/wrong-answers.test.ts
git commit -m "$(cat <<'EOF'
feat(api/admin): wrong-answer reports with retrieval-trace snapshots

POST snapshots messages.retrieval_trace, parses fused_top12 KB candidates,
returns them with question + snippet for the admin modal.
PATCH sets fixed_kb_id after the admin lands the fix.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add `onSaved` callback prop to `<KbEditor>`

**Files:**
- Modify: `components/admin/kb-editor.tsx`

The component currently hardcodes `router.push('/admin/kb')` after save. Add an optional `onSaved?: (item) => void` prop; when present, call it with the updated row from the response instead of navigating. The KB list page behavior is unchanged.

- [ ] **Step 1: Update the component signature and submit handler**

Open `components/admin/kb-editor.tsx`. Change the function signature:

```typescript
// before
export function KbEditor({ id }: { id: string }) {

// after
export function KbEditor({
  id,
  onSaved,
}: {
  id: string;
  onSaved?: (item: any) => void;
}) {
```

Update the success branch of `submit`:

```typescript
// before (around line 86)
if (res.ok) router.push('/admin/kb');
else alert('Save failed');

// after
if (res.ok) {
  if (onSaved) {
    const data = await res.json();
    onSaved(data.item);
  } else {
    router.push('/admin/kb');
  }
} else {
  alert('Save failed');
}
```

- [ ] **Step 2: Confirm the existing KB detail page still works**

The existing caller in `app/admin/kb/[id]/page.tsx` passes only `id` — `onSaved` defaults to `undefined`, so the old `router.push` path runs. No code change to that page.

Spin up the dev server briefly to smoke-test (only if you have time / a server already running):

```bash
npm run dev
```

Navigate to `http://localhost:3000/admin/kb` → click any entry → edit a field → Save → confirm you're redirected back to `/admin/kb`. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add components/admin/kb-editor.tsx
git commit -m "$(cat <<'EOF'
feat(admin): KbEditor accepts optional onSaved callback for modal reuse

When onSaved is provided, the editor calls it with the updated KB row
instead of navigating to /admin/kb. Existing list page caller is unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `/admin/prompts` list page

**Files:**
- Create: `app/admin/prompts/page.tsx`

Server component that fetches from the admin API or the DB directly. Following the project pattern in `app/admin/layout.tsx` (server-side `query()` call), fetch directly from the DB — avoids one HTTP hop and is the established pattern.

- [ ] **Step 1: Write the page**

Create `app/admin/prompts/page.tsx`:

```typescript
import Link from 'next/link';
import { query } from '@/lib/db/client';

const SECTION_TITLES: Record<string, string> = {
  intro_and_rules: 'Intro & Rules',
  tools_inventory: 'Tools Inventory',
  consultant_mode: 'Consultant Mode',
  dalgo_vs_3rd_party: 'Dalgo vs 3rd-Party Boundary',
  fit_assessment: 'Fit Assessment Mode',
};

const ORDER = [
  'intro_and_rules',
  'tools_inventory',
  'consultant_mode',
  'dalgo_vs_3rd_party',
  'fit_assessment',
];

type Row = {
  key: string;
  content: string;
  updated_by: string;
  updated_at: string;
};

export default async function PromptsListPage() {
  const { rows } = await query<Row>(
    `SELECT key, content, updated_by, updated_at FROM dalgo_prompts`,
  );
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const ordered = ORDER.map((k) => byKey.get(k)).filter((r): r is Row => Boolean(r));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl">Prompts</h2>
        <p className="text-sm text-slate-500">
          Edit the bot's system prompt sections. Changes take effect on the next chat request (cached up to 60 seconds).
        </p>
      </div>
      <ul className="space-y-3">
        {ordered.map((p) => (
          <li
            key={p.key}
            className="border rounded p-4 bg-white hover:bg-slate-50"
          >
            <Link href={`/admin/prompts/${p.key}`} className="block space-y-2">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium text-slate-900">
                  {SECTION_TITLES[p.key] ?? p.key}
                </h3>
                <span className="text-xs text-slate-500">
                  {new Date(p.updated_at).toLocaleString()} · {p.updated_by}
                </span>
              </div>
              <p className="text-sm text-slate-600 line-clamp-2 font-mono">
                {p.content.slice(0, 200)}
                {p.content.length > 200 ? '…' : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
```

Open `http://localhost:3000/admin/prompts` (logging in if needed). Confirm:
- 5 cards in the documented order
- Each shows a title, timestamp + email, and a content preview
- Cards link to `/admin/prompts/<key>` (404s right now — that's expected, the next task creates the detail page)

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/admin/prompts/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): /admin/prompts list page with 5 prompt section cards

Server-rendered list ordered intro -> tools -> consultant -> boundary -> fit.
Each card shows last edit + content preview, links to detail page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `/admin/prompts/[key]` detail page (editor + version history + diff)

**Files:**
- Create: `app/admin/prompts/[key]/page.tsx`
- Create: `components/admin/prompt-editor.tsx` (client component holding the editor state, version list, diff modal)
- Create: `components/admin/diff-viewer.tsx` (simple line diff component)
- Modify: `package.json` (add `diff` dependency)

For diffing, use the [`diff`](https://www.npmjs.com/package/diff) package (`npm i diff`) — it's tiny (≈10 KB), maintained, has TS types, and exports `diffLines()` which is exactly what we need.

- [ ] **Step 1: Add the `diff` dependency**

```bash
npm install diff
npm install --save-dev @types/diff
```

Confirm with `grep '"diff"' package.json` — should appear in both `dependencies` and `devDependencies`.

- [ ] **Step 2: Create the diff viewer component**

Create `components/admin/diff-viewer.tsx`:

```typescript
'use client';
import { diffLines } from 'diff';

export function DiffViewer({ oldText, newText }: { oldText: string; newText: string }) {
  const parts = diffLines(oldText, newText);
  return (
    <pre className="text-xs font-mono whitespace-pre-wrap border rounded p-3 bg-slate-50 max-h-[60vh] overflow-y-auto">
      {parts.map((p, i) => {
        const cls = p.added
          ? 'bg-green-100 text-green-900'
          : p.removed
            ? 'bg-red-100 text-red-900 line-through'
            : 'text-slate-600';
        return (
          <span key={i} className={cls}>
            {p.value}
          </span>
        );
      })}
    </pre>
  );
}
```

- [ ] **Step 3: Create the editor client component**

Create `components/admin/prompt-editor.tsx`:

```typescript
'use client';
import { useEffect, useState } from 'react';
import { DiffViewer } from '@/components/admin/diff-viewer';

type Prompt = {
  key: string;
  content: string;
  updated_by: string;
  updated_at: string;
};

type Version = {
  id: number;
  prompt_key: string;
  content: string;
  updated_by: string;
  updated_at: string;
};

export function PromptEditor({ promptKey }: { promptKey: string }) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [draft, setDraft] = useState('');
  const [versions, setVersions] = useState<Version[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [diffWith, setDiffWith] = useState<Version | null>(null);

  async function reload() {
    const [p, v] = await Promise.all([
      fetch(`/api/admin/prompts/${promptKey}`).then((r) => r.json()),
      fetch(`/api/admin/prompts/${promptKey}/versions`).then((r) => r.json()),
    ]);
    setPrompt(p.item);
    setDraft(p.item.content);
    setVersions(v.versions);
  }

  useEffect(() => {
    reload();
  }, [promptKey]);

  async function save() {
    if (!prompt) return;
    setSaving(true);
    const res = await fetch(`/api/admin/prompts/${promptKey}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: draft }),
    });
    setSaving(false);
    if (res.ok) {
      setToast('Saved. Takes effect within 60 seconds.');
      await reload();
      setTimeout(() => setToast(null), 4000);
    } else {
      setToast('Save failed.');
      setTimeout(() => setToast(null), 4000);
    }
  }

  if (!prompt) return <p>Loading…</p>;
  const dirty = draft !== prompt.content;

  return (
    <div className="grid grid-cols-[1fr_22rem] gap-6">
      {/* Editor */}
      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full font-mono text-sm border rounded p-3 min-h-[60vh] resize-y"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="bg-slate-900 text-white px-4 py-2 rounded disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setDraft(prompt.content)}
            disabled={!dirty || saving}
            className="border px-4 py-2 rounded disabled:opacity-40"
          >
            Cancel
          </button>
          {toast && <span className="text-sm text-slate-600 ml-2">{toast}</span>}
        </div>
      </div>

      {/* Version history */}
      <aside className="space-y-2">
        <h3 className="font-medium text-slate-900">Version history</h3>
        <ul className="space-y-1 max-h-[60vh] overflow-y-auto border rounded">
          {versions.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setDiffWith(v)}
                className="w-full text-left text-xs p-2 hover:bg-slate-50 border-b last:border-b-0"
              >
                <div>{new Date(v.updated_at).toLocaleString()}</div>
                <div className="text-slate-500">{v.updated_by}</div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Diff modal */}
      {diffWith && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-40"
          onClick={() => setDiffWith(null)}
        >
          <div
            className="bg-white rounded shadow-lg p-4 w-[90vw] max-w-3xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-medium">
                Diff: {new Date(diffWith.updated_at).toLocaleString()} → current
              </h4>
              <button
                type="button"
                onClick={() => setDiffWith(null)}
                className="text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>
            </div>
            <DiffViewer oldText={diffWith.content} newText={prompt.content} />
            <p className="text-xs text-slate-500">
              No restore button — copy any blocks you want from the diff into the editor manually.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create the page**

Create `app/admin/prompts/[key]/page.tsx`:

```typescript
import { PromptEditor } from '@/components/admin/prompt-editor';

const SECTION_TITLES: Record<string, string> = {
  intro_and_rules: 'Intro & Rules',
  tools_inventory: 'Tools Inventory',
  consultant_mode: 'Consultant Mode',
  dalgo_vs_3rd_party: 'Dalgo vs 3rd-Party Boundary',
  fit_assessment: 'Fit Assessment Mode',
};

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const title = SECTION_TITLES[key] ?? key;
  return (
    <div className="space-y-4">
      <h2 className="text-2xl">{title}</h2>
      <PromptEditor promptKey={key} />
    </div>
  );
}
```

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
```

Open `http://localhost:3000/admin/prompts/dalgo_vs_3rd_party`. Confirm:
- Editor loads with current content
- Version history sidebar shows at least one entry (the seed)
- Edit a sentence, click Save, toast appears, sidebar grows by one row
- Click an older sidebar entry → diff modal opens with the older content on the left (red) and current on the right (green)
- Refresh the page → edit is persisted

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add app/admin/prompts/\[key\]/page.tsx components/admin/prompt-editor.tsx components/admin/diff-viewer.tsx package.json package-lock.json
git commit -m "$(cat <<'EOF'
feat(admin): /admin/prompts/[key] editor + version history + diff

Split layout (editor + sidebar of versions). Click a version to see a line
diff against the current saved content (no restore button — copy manually).
Adds 'diff' npm dep.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `<WrongAnswerModal>` + button on conversation detail page

**Files:**
- Create: `components/admin/wrong-answer-modal.tsx`
- Modify: `app/admin/conversations/[id]/page.tsx`

Three-stage modal: reason → pick candidate → edit KB via existing `<KbEditor>` with `onSaved` callback.

- [ ] **Step 1: Create the modal**

Create `components/admin/wrong-answer-modal.tsx`:

```typescript
'use client';
import { useState } from 'react';
import { KbEditor } from '@/components/admin/kb-editor';

type Candidate = {
  kb_id: string;
  question: string;
  snippet: string;
  score: number;
};

type Stage = 'reason' | 'pick' | 'edit' | 'no_trace';

export function WrongAnswerModal({
  messageId,
  onClose,
}: {
  messageId: string;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>('reason');
  const [reason, setReason] = useState('');
  const [reportId, setReportId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [chosen, setChosen] = useState<Candidate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitReason() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/wrong-answers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, reason }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setReportId(json.id);
      setCandidates(json.candidates);
      setStage(json.candidates.length === 0 ? 'no_trace' : 'pick');
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function patchFixed(kbId: string) {
    if (!reportId) return;
    await fetch(`/api/admin/wrong-answers/${reportId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fixed_kb_id: kbId }),
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded shadow-lg p-5 w-[90vw] max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-lg">
            {stage === 'reason' && 'Report a wrong answer'}
            {stage === 'pick' && 'Pick the KB entry to fix'}
            {stage === 'edit' && 'Edit KB entry'}
            {stage === 'no_trace' && 'Report saved'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900"
          >
            ✕
          </button>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        {stage === 'reason' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              What was wrong about this answer? This will be saved for review and used to find the KB entry to fix.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The bot claimed Dalgo has RLS, but RLS is a Superset feature."
              rows={5}
              className="w-full border rounded p-2 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="border px-4 py-2 rounded text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReason}
                disabled={reason.trim().length === 0 || submitting}
                className="bg-slate-900 text-white px-4 py-2 rounded text-sm disabled:opacity-40"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        )}

        {stage === 'pick' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              These KB entries were the top candidates that fed this answer. Pick the one that misled the bot, or skip if none apply.
            </p>
            <ul className="space-y-2">
              {candidates.map((c) => (
                <li key={c.kb_id}>
                  <button
                    type="button"
                    onClick={() => { setChosen(c); setStage('edit'); }}
                    className="w-full text-left border rounded p-3 hover:bg-slate-50"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium text-sm">{c.question}</span>
                      <span className="text-xs text-slate-500">score {c.score.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1 line-clamp-2">{c.snippet}</div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="border px-4 py-2 rounded text-sm"
              >
                None of these — skip fix
              </button>
            </div>
          </div>
        )}

        {stage === 'edit' && chosen && (
          <KbEditor
            id={chosen.kb_id}
            onSaved={async () => {
              await patchFixed(chosen.kb_id);
              onClose();
            }}
          />
        )}

        {stage === 'no_trace' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              No retrieval trace is available for this message (it was sent before Phase 3 retrieval tracing). Your report has been saved but there's no candidate to fix inline.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-900 text-white px-4 py-2 rounded text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the button + modal mount on the conversation detail page**

Open `app/admin/conversations/[id]/page.tsx`. Add an import:

```typescript
import { WrongAnswerModal } from '@/components/admin/wrong-answer-modal';
```

Add a state hook alongside the existing ones:

```typescript
const [wrongFor, setWrongFor] = useState<string | null>(null);
```

In the per-message button row, add a third button after the existing "View retrieval debug":

```tsx
<button
  className="text-red-600 underline"
  onClick={() => setWrongFor(m.id)}
>⚠ This answer is wrong</button>
```

At the bottom of the JSX (after the existing `{debugFor && ...}` block), mount the modal:

```tsx
{wrongFor && (
  <WrongAnswerModal messageId={wrongFor} onClose={() => setWrongFor(null)} />
)}
```

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

1. Open `http://localhost:3000/admin/conversations` and click any conversation with assistant messages that have a retrieval trace (any conversation from the past week of dev).
2. Click "⚠ This answer is wrong" on an assistant message.
3. Write a reason → Submit. Modal advances to candidate list.
4. Click a candidate. Modal advances to the KB editor with the chosen row pre-filled.
5. Edit a field → Save. Modal closes. Toast or just-closed modal is fine.
6. Verify in DB:

```bash
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery -c \
  "SELECT id, reason, fixed_kb_id FROM wrong_answer_reports ORDER BY reported_at DESC LIMIT 3;"
```

Expected: latest row has the reason text and `fixed_kb_id` populated.

7. Also test the "skip fix" path: report a different message, click "None of these — skip fix". Modal closes. Verify the report row exists with `fixed_kb_id = NULL`.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add components/admin/wrong-answer-modal.tsx app/admin/conversations/\[id\]/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): 'This answer is wrong' workflow on conversation detail

3-stage modal: reason -> pick candidate from retrieval_trace -> edit
KB row inline via existing KbEditor (using new onSaved callback).
Persists every report; PATCHes fixed_kb_id on successful fix.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Sidebar nav — add Prompts link

**Files:**
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Add the link between Knowledge Base and Blogs**

Open `app/admin/layout.tsx`. Add a new `<Link>` between the existing KB link and the Blogs link:

```tsx
<Link className="block hover:underline" href="/admin/kb">
  Knowledge Base
</Link>
<Link className="block hover:underline" href="/admin/prompts">
  Prompts
</Link>
<Link className="block hover:underline" href="/admin/blogs">
  Blogs
</Link>
```

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
```

Open `http://localhost:3000/admin`. Confirm the sidebar shows: Leads / Knowledge Base / **Prompts** / Blogs / Unanswered / Conversations. Click "Prompts" → lands on the list page.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "$(cat <<'EOF'
feat(admin): sidebar nav adds Prompts link

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Re-run eval + JOURNAL entry

The eval suite confirms the async refactor didn't regress retrieval/synthesis behavior. Expected score: 45/50 (unchanged from `a9b8ed0`).

**Files:**
- Modify: `docs/JOURNAL.md` (append entry)

- [ ] **Step 1: Run the full test suite first**

```bash
npm test
```

Expected: all tests pass (including the new 4 test files).

- [ ] **Step 2: Run the eval suite**

```bash
npm run eval
```

Expected: ~$0.50 spend, ~20 min wall time. Look for a final summary line stating the total score. Acceptance: ≥ 45/50.

If score drops:
- Compare what `staticSystem()` returns now (`await staticSystem()` in a REPL or a one-off script) against the original hardcoded string from `git show a9b8ed0:lib/llm/system-prompt.ts`. They should be byte-identical for byte-identical seed content.
- Most likely cause of a regression: whitespace drift in the seed `INSERT`s. Fix by re-running `001_prompts.sql` with corrected content (use `ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content` for re-runnability — or just `UPDATE` the affected row directly).

- [ ] **Step 3: Append a JOURNAL entry**

Open `docs/JOURNAL.md`. Append using the template format already used in earlier entries (read the most recent entry for tone — keep it factual, no fluff):

```markdown
## 2026-05-26 — Admin-editable prompts + wrong-answer feedback loop

**Added:**
- 3 tables: `dalgo_prompts` (5 sections seeded from `staticSystem()`), `dalgo_prompt_versions` (append-only history), `wrong_answer_reports`
- `lib/llm/prompts.ts` — `getPrompt` cache (60s TTL + manual bust via `invalidatePromptCache`)
- `staticSystem()` rewritten to assemble from DB in parallel via `getPrompt`; callers in chat route + eval runner switched to `await`
- Admin API: GET/PUT `/api/admin/prompts`, GET `/api/admin/prompts/[key]/versions`, POST/PATCH `/api/admin/wrong-answers`
- `/admin/prompts` list + `/admin/prompts/[key]` detail page with version sidebar + line diff modal
- `<WrongAnswerModal>` on conversation detail: reason → pick candidate from `retrieval_trace` → edit KB row inline (reuses existing `<KbEditor>` with new `onSaved` prop)
- Sidebar nav: Prompts entry between Knowledge Base and Blogs

**Removed:**
- Hardcoded prompt string in `lib/llm/system-prompt.ts` (now DB-backed)

**Why:**
The product/consultant team can now fix prompt rules and KB rows from `/admin` without an engineer or a redeploy. Closes the manual editorial loop that previously required code changes — see `a9b8ed0` for the kind of fix this enables (Dalgo-vs-3rd-party hard boundary + RLS/Superset hallucination patches).

**Eval delta:**
50-case suite: 45/50 → 45/50 (no regression). The refactor is plumbing — seed content is byte-identical to the previous hardcoded string.

**Carried forward:**
- Wrong-answer report queue/dashboard UI (table persists data, but no read surface in v1)
- Per-user permission tiers on prompt editing (all admins can edit)
- One-click "Restore version" (admins copy from diff modal manually)
- Branch `feat/blog-ingestion` still not merged or pushed — user-driven decisions
```

- [ ] **Step 4: Commit**

```bash
git add docs/JOURNAL.md
git commit -m "$(cat <<'EOF'
docs(journal): admin-editable prompts + wrong-answer loop shipped

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Schema (3 tables, seed, migration) → Task 1
- ✅ `lib/llm/prompts.ts` cache → Task 2
- ✅ `staticSystem()` async refactor + caller updates → Task 3
- ✅ Prompts CRUD API (list/get/put/versions) → Task 4
- ✅ Wrong-answer API (POST + PATCH + candidate parsing) → Task 5
- ✅ `<KbEditor>` `onSaved` prop → Task 6
- ✅ `/admin/prompts` list → Task 7
- ✅ `/admin/prompts/[key]` editor + history + diff → Task 8
- ✅ `<WrongAnswerModal>` + button on conversation page → Task 9
- ✅ Sidebar nav update → Task 10
- ✅ Eval re-run + JOURNAL → Task 11
- ✅ Error handling per spec: missing key throws (Task 2), 404s for unknown key/message (Tasks 4-5), modal `no_trace` stage handles old messages (Task 9), `KbEditor` `alert('Save failed')` remains as the embed-failure surface (Task 6 — relies on PATCH route returning 500 if embedding fails)

**2. Placeholder scan:** No `TBD`/`TODO`/"implement later". Every step has either complete code, an exact command, or both.

**3. Type consistency:**
- `Candidate` shape (`{kb_id, question, snippet, score}`) is consistent between Task 5 (API) and Task 9 (modal)
- `Prompt`/`Version` types in Task 8's PromptEditor match the API response shapes from Task 4
- `__resetForTests`/`__cacheStatsForTests` exports added in Task 2 are referenced in Task 3's test file — both defined

**4. Risk callouts for the implementer:**
- The seed `INSERT`s in `scripts/migrations/001_prompts.sql` use `$prompt$ ... $prompt$` dollar-quoting. If any seed content itself contains `$prompt$`, change the tag (e.g., `$dp1$`). Sanity-check by grepping the seed inserts for `$prompt$` after pasting.
- The existing `app/api/admin/kb/[id]/route.ts` PATCH route shadows `rows` between the inner `if (needsReembed)` block and the outer scope — TypeScript handles this fine, but be aware if you're modifying that file.
- Task 3's typecheck step (`npx tsc --noEmit`) is the load-bearing safety net for the async refactor. If it passes and `npm test` passes, every call site is correctly awaited.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-26-admin-editable-prompts.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration with isolated context.
2. **Inline Execution** — Execute tasks in this session using executing-plans, with batch execution + checkpoints for review.

Which approach?
