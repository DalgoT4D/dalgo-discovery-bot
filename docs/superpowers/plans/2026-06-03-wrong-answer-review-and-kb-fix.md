# Wrong-answer Review Queue + LLM-assisted KB Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a review queue for wrong-answer reports where they approve an LLM-drafted fix that updates the knowledge base (re-embedded, versioned), is verified by a retrieval re-run, and is regression-protected by an auto-created eval case.

**Architecture:** Reports already land in `wrong_answer_reports`. We add lifecycle state to that table, a `GET` list endpoint, an `/admin/wrong-answers` page, an LLM draft-fix module + endpoint, and a transactional `resolve` endpoint that writes the KB (create-or-edit), re-runs retrieval to confirm, and optionally creates an eval case. The mark-wrong modal also captures an optional suggested answer.

**Tech Stack:** Next.js 16 App Router, raw `pg`, Vercel AI SDK v4 (`generateText`), pgvector embeddings (`lib/embeddings.ts`), NextAuth v5 (`auth()`), Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-03-wrong-answer-review-and-kb-fix-design.md`

---

## Reference facts (verified against the codebase)

- `wrong_answer_reports` today: `id bigserial`, `message_id uuid`, `reason text`, `retrieval_trace_snap jsonb`, `fixed_kb_id uuid`, `reported_by text`, `reported_at timestamptz`. Defined in `lib/db/schema.sql:270`.
- `dalgo_knowledge_base.source` CHECK currently allows `'seed' | 'admin_manual' | 'promoted_from_conversation' | 'promoted_from_unanswered'`. We add `'wrong_answer_fix'`.
- KB create: `app/api/admin/kb/route.ts` POST embeds `"${variants.join(' | ')}\n\n${answer}"` and inserts.
- KB edit/version: `app/api/admin/kb/[id]/route.ts` PATCH snapshots into `dalgo_kb_versions`, re-embeds when `question_variants`/`canonical_answer` change, dynamic SET, all in a `withClient` transaction.
- LLM draft pattern: `lib/llm/extract-qa.ts` uses `generateText({ model: anthropic('claude-haiku-4-5-20251001') })`, strips fences, `JSON.parse`.
- Embeddings: `import { embed } from '@/lib/embeddings'` → `Promise<number[]>` (1536 dims). Vector literal: `` `[${vec.join(',')}]` ``.
- Retrieval re-run: `import { runPipeline } from '@/lib/llm/rag/pipeline'`; `runPipeline(userMsg)` → `{ topPassages: {id,...}[], trace: { fused_top12: {id,score,source,preview}[], final_context_ids: string[], ... } }`.
- Eval case create: `import { createEvalCase } from '@/lib/db/queries/eval-cases'`; `createEvalCase({ case_key, bucket, input, expected, judges, enabled, notes, updated_by }) → Promise<string>`. `case_key` is UNIQUE.
- `EvalCase.expected` type lives in `lib/llm/eval/cases/types.ts`; judges read keys: retrieval-judge (`must_cite_one_of`, `must_not_hallucinate_urls`, `matched_pattern`), llm-judge (`structure`, `must_express_uncertainty`), exact-match (`must_record_unanswered`). We add `answer_must_convey` to llm-judge.
- Admin nav: `app/admin/layout.tsx` builds nav from a `NAV` array; `unanswered` badge counts via a query. Auth on every admin route: `const session = await auth(); if (!session?.user) return 401`.
- Tests run with `npm test -- <path>` (Vitest, loads `.env.local`). DB-backed tests connect to the Docker Postgres on 5436; close the pool in `afterAll` with `await pool().end()`.

---

## Task 1: Migration — lifecycle columns + KB source value

**Files:**
- Modify: `lib/db/schema.sql:270-280` (the `wrong_answer_reports` block + the KB `source` CHECK)
- Create: `tests/lib/db/wrong-answer-reports-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/db/wrong-answer-reports-schema.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';

const SID = '00000000-0000-0000-0000-0000000000b1';

describe('wrong_answer_reports lifecycle columns', () => {
  it('accepts suggested_answer + status + resolution columns and defaults status=pending', async () => {
    await query(`INSERT INTO sessions (id) VALUES ($1) ON CONFLICT DO NOTHING`, [SID]);
    const m = await query<{ id: string }>(
      `INSERT INTO messages (session_id, role, content) VALUES ($1,'assistant','{"text":"x"}'::jsonb) RETURNING id`,
      [SID],
    );
    const r = await query<{ status: string }>(
      `INSERT INTO wrong_answer_reports (message_id, reason, suggested_answer, reported_by)
       VALUES ($1,'wrong','should say Y','a@b.com') RETURNING status`,
      [m.rows[0].id],
    );
    expect(r.rows[0].status).toBe('pending');

    const u = await query<{ status: string; fix_kind: string }>(
      `UPDATE wrong_answer_reports
          SET status='resolved', fix_kind='created', resolved_by='a@b.com', resolved_at=now()
        WHERE message_id=$1 RETURNING status, fix_kind`,
      [m.rows[0].id],
    );
    expect(u.rows[0].status).toBe('resolved');
    expect(u.rows[0].fix_kind).toBe('created');

    await query(`DELETE FROM sessions WHERE id=$1`, [SID]); // cascades report+message
  });

  it('allows wrong_answer_fix as a KB source value', async () => {
    const k = await query<{ id: string }>(
      `INSERT INTO dalgo_knowledge_base
         (category, question_variants, canonical_answer, status, source, embedding)
       VALUES ('ai', ARRAY['q'], 'a', 'no', 'wrong_answer_fix', $1::vector) RETURNING id`,
      [`[${Array(1536).fill(0).join(',')}]`],
    );
    expect(k.rows[0].id).toBeTruthy();
    await query(`DELETE FROM dalgo_knowledge_base WHERE id=$1`, [k.rows[0].id]);
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/lib/db/wrong-answer-reports-schema.test.ts`
Expected: FAIL — `column "suggested_answer" of relation "wrong_answer_reports" does not exist` (and the source CHECK rejects `wrong_answer_fix`).

- [ ] **Step 3: Update `schema.sql`**

In `lib/db/schema.sql`, replace the `wrong_answer_reports` table block (currently ending at the `reported_at` line) so the columns include the new ones:

```sql
CREATE TABLE IF NOT EXISTS wrong_answer_reports (
  id                   bigserial PRIMARY KEY,
  message_id           uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reason               text NOT NULL,
  suggested_answer     text,
  retrieval_trace_snap jsonb,
  fixed_kb_id          uuid REFERENCES dalgo_knowledge_base(id) ON DELETE SET NULL,
  fix_kind             text CHECK (fix_kind IN ('edited','created')),
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','resolved','dismissed')),
  reported_by          text NOT NULL,
  reported_at          timestamptz NOT NULL DEFAULT now(),
  resolved_by          text,
  resolved_at          timestamptz
);
```

Then find the `dalgo_knowledge_base` `source` CHECK in `schema.sql` and add `'wrong_answer_fix'` to its allowed list.

- [ ] **Step 4: Apply the migration to the live DB**

Run:
```bash
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery <<'SQL'
ALTER TABLE wrong_answer_reports ADD COLUMN IF NOT EXISTS suggested_answer text;
ALTER TABLE wrong_answer_reports ADD COLUMN IF NOT EXISTS fix_kind text;
ALTER TABLE wrong_answer_reports ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE wrong_answer_reports ADD COLUMN IF NOT EXISTS resolved_by text;
ALTER TABLE wrong_answer_reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE wrong_answer_reports DROP CONSTRAINT IF EXISTS wrong_answer_reports_status_check;
ALTER TABLE wrong_answer_reports ADD CONSTRAINT wrong_answer_reports_status_check CHECK (status IN ('pending','resolved','dismissed'));
ALTER TABLE wrong_answer_reports DROP CONSTRAINT IF EXISTS wrong_answer_reports_fix_kind_check;
ALTER TABLE wrong_answer_reports ADD CONSTRAINT wrong_answer_reports_fix_kind_check CHECK (fix_kind IN ('edited','created'));
ALTER TABLE dalgo_knowledge_base DROP CONSTRAINT IF EXISTS dalgo_knowledge_base_source_check;
ALTER TABLE dalgo_knowledge_base ADD CONSTRAINT dalgo_knowledge_base_source_check
  CHECK (source IN ('seed','admin_manual','promoted_from_conversation','promoted_from_unanswered','wrong_answer_fix'));
SQL
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/lib/db/wrong-answer-reports-schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.sql tests/lib/db/wrong-answer-reports-schema.test.ts
git commit -m "feat(db): wrong_answer_reports lifecycle columns + wrong_answer_fix KB source"
```

---

## Task 2: Capture `suggested_answer` at report time

**Files:**
- Modify: `app/api/admin/wrong-answers/route.ts` (the `CreateBody` zod schema + INSERT)
- Modify: `components/admin/wrong-answer-modal.tsx` (add optional field, send it)
- Test: `tests/api/admin/wrong-answers.test.ts` (extend)

- [ ] **Step 1: Write the failing test** (append to the existing file's POST describe block)

```ts
// tests/api/admin/wrong-answers.test.ts — add inside the existing describe
it('persists an optional suggested_answer', async () => {
  // assumes the file already sets up an admin session mock + a seeded message id `messageId`
  const res = await POST(makeReq({ message_id: messageId, reason: 'wrong', suggested_answer: 'should say Z' }));
  expect(res.status).toBe(200);
  const { rows } = await query<{ suggested_answer: string }>(
    `SELECT suggested_answer FROM wrong_answer_reports ORDER BY id DESC LIMIT 1`,
  );
  expect(rows[0].suggested_answer).toBe('should say Z');
});
```

(Use the existing helpers in that test file — `makeReq`, the auth mock, `messageId`, and `query` import. If the file lacks a `makeReq` helper, mirror the request construction already used by its passing POST test.)

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/api/admin/wrong-answers.test.ts`
Expected: FAIL — `suggested_answer` comes back `null` (route ignores it).

- [ ] **Step 3: Update the route**

In `app/api/admin/wrong-answers/route.ts`, extend the body schema and the INSERT:

```ts
const CreateBody = z.object({
  message_id: z.string().uuid(),
  reason: z.string().min(1),
  suggested_answer: z.string().optional(),
});
```

```ts
const { rows } = await query<{ id: string }>(
  `INSERT INTO wrong_answer_reports
     (message_id, reason, suggested_answer, retrieval_trace_snap, reported_by)
   VALUES ($1, $2, $3, $4::jsonb, $5)
   RETURNING id`,
  [body.message_id, body.reason, body.suggested_answer ?? null, trace ? JSON.stringify(trace) : null, email],
);
```

- [ ] **Step 4: Add the optional field to the modal**

In `components/admin/wrong-answer-modal.tsx`, add state `const [suggested, setSuggested] = useState('');`, include it in the POST body (`body: JSON.stringify({ message_id: messageId, reason, suggested_answer: suggested || undefined })`), and render a second textarea below the reason one in the `stage === 'reason'` block:

```tsx
<label className="text-sm font-medium text-foreground">What should it have said? (optional)</label>
<textarea
  value={suggested}
  onChange={(e) => setSuggested(e.target.value)}
  placeholder="The correct answer, if you know it — the assistant will draft a KB fix from this."
  rows={4}
  className="w-full border border-border rounded-md p-2 text-sm bg-card text-foreground"
/>
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- tests/api/admin/wrong-answers.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/wrong-answers/route.ts components/admin/wrong-answer-modal.tsx tests/api/admin/wrong-answers.test.ts
git commit -m "feat(wrong-answers): capture optional suggested_answer at report time"
```

---

## Task 3: `GET /api/admin/wrong-answers` list endpoint

**Files:**
- Modify: `app/api/admin/wrong-answers/route.ts` (add `GET`)
- Create: `tests/api/admin/wrong-answers-list.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/admin/wrong-answers-list.test.ts
import { describe, it, expect, vi, afterAll, beforeAll } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => ({ user: { email: 'admin@dalgo.org' } })) }));

const SID = '00000000-0000-0000-0000-0000000000c3';
let messageId: string;

beforeAll(async () => {
  await query(`INSERT INTO sessions (id) VALUES ($1) ON CONFLICT DO NOTHING`, [SID]);
  const u = await query(`INSERT INTO messages (session_id, role, content) VALUES ($1,'user','{"text":"does dalgo do X?"}'::jsonb) RETURNING id`, [SID]);
  const a = await query<{ id: string }>(`INSERT INTO messages (session_id, role, content) VALUES ($1,'assistant','{"text":"yes"}'::jsonb) RETURNING id`, [SID]);
  messageId = a.rows[0].id;
  void u;
  await query(`INSERT INTO wrong_answer_reports (message_id, reason, reported_by, status) VALUES ($1,'bad answer','admin@dalgo.org','pending')`, [messageId]);
});

describe('GET /api/admin/wrong-answers', () => {
  it('returns pending reports with message text + session id', async () => {
    const { GET } = await import('@/app/api/admin/wrong-answers/route');
    const req = new Request('http://t/api/admin/wrong-answers?status=pending');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    const row = json.reports.find((r: any) => r.message_id === messageId);
    expect(row).toBeTruthy();
    expect(row.reason).toBe('bad answer');
    expect(row.session_id).toBe(SID);
    expect(typeof row.answer_text).toBe('string');
  });

  afterAll(async () => {
    await query(`DELETE FROM sessions WHERE id=$1`, [SID]);
    await pool().end();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/api/admin/wrong-answers-list.test.ts`
Expected: FAIL — `GET` is not exported.

- [ ] **Step 3: Add the `GET` handler** to `app/api/admin/wrong-answers/route.ts`

```ts
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const status = new URL(req.url).searchParams.get('status'); // pending | resolved | dismissed | null(all)
  const params: unknown[] = [];
  let where = '';
  if (status && ['pending', 'resolved', 'dismissed'].includes(status)) {
    params.push(status);
    where = `WHERE w.status = $1`;
  }

  const { rows } = await query(
    `SELECT w.id, w.message_id, w.reason, w.suggested_answer, w.status, w.fix_kind,
            w.fixed_kb_id, w.reported_by, w.reported_at, w.resolved_by, w.resolved_at,
            m.session_id,
            (m.content->>'text') AS answer_text
       FROM wrong_answer_reports w
       JOIN messages m ON m.id = w.message_id
       ${where}
      ORDER BY (w.status = 'pending') DESC, w.reported_at DESC`,
    params,
  );
  return NextResponse.json({ reports: rows });
}
```

`NextRequest` is already imported in this file. Note `GET` accepts a `Request`/`NextRequest`; the test passes a plain `Request`, which is fine.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/api/admin/wrong-answers-list.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/wrong-answers/route.ts tests/api/admin/wrong-answers-list.test.ts
git commit -m "feat(wrong-answers): GET list endpoint with message join + status filter"
```

---

## Task 4: `/admin/wrong-answers` page + nav entry

**Files:**
- Create: `app/admin/wrong-answers/page.tsx`
- Create: `components/admin/wrong-answers-table.tsx`
- Modify: `app/admin/layout.tsx` (add to `NAV`)

This task is UI; verification is manual + the endpoint test above. No new automated test.

- [ ] **Step 1: Add the nav entry**

In `app/admin/layout.tsx`, find the `NAV` array (the const the layout maps over) and add an entry. Place it after the existing "Conversations" / "Unanswered" entries:

```ts
{ href: '/admin/wrong-answers', label: 'Wrong answers' },
```

- [ ] **Step 2: Create the table component**

```tsx
// components/admin/wrong-answers-table.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WrongAnswerResolveModal } from '@/components/admin/wrong-answer-resolve-modal';

type Report = {
  id: number; message_id: string; reason: string; suggested_answer: string | null;
  status: 'pending' | 'resolved' | 'dismissed'; fix_kind: string | null; fixed_kb_id: string | null;
  reported_by: string; reported_at: string; session_id: string; answer_text: string;
};

export function WrongAnswersTable() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<'pending' | 'resolved' | 'dismissed' | 'all'>('pending');
  const [openId, setOpenId] = useState<number | null>(null);

  async function load() {
    const qs = filter === 'all' ? '' : `?status=${filter}`;
    const res = await fetch(`/api/admin/wrong-answers${qs}`);
    if (res.ok) setReports((await res.json()).reports);
  }
  useEffect(() => { void load(); }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['pending', 'resolved', 'dismissed', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-sm ${filter === f ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
            {f}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {reports.map((r) => (
          <li key={r.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{r.reason}</span>
              <span className="text-xs text-muted-foreground">{r.status}{r.fix_kind ? ` · ${r.fix_kind}` : ''}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.answer_text}</p>
            {r.suggested_answer && <p className="mt-1 text-xs text-foreground">Suggested: {r.suggested_answer}</p>}
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">{r.reported_by} · {new Date(r.reported_at).toLocaleString()}</span>
              <Link className="text-primary underline" href={`/admin/conversations/${r.session_id}`}>View conversation</Link>
              {r.status === 'pending' && (
                <button className="text-primary underline" onClick={() => setOpenId(r.id)}>Review &amp; fix</button>
              )}
            </div>
          </li>
        ))}
        {reports.length === 0 && <li className="text-sm text-muted-foreground">No reports.</li>}
      </ul>
      {openId !== null && (
        <WrongAnswerResolveModal reportId={openId} onClose={() => { setOpenId(null); void load(); }} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the page**

```tsx
// app/admin/wrong-answers/page.tsx
import { WrongAnswersTable } from '@/components/admin/wrong-answers-table';

export default function WrongAnswersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Wrong answers</h1>
      <WrongAnswersTable />
    </div>
  );
}
```

(`WrongAnswerResolveModal` is built in Task 8. Until then this page imports a not-yet-existing component — do Tasks 5–8 before relying on the build. To keep the build green if executing strictly in order, stub `components/admin/wrong-answer-resolve-modal.tsx` with `export function WrongAnswerResolveModal(_: { reportId: number; onClose: () => void }) { return null; }` here and replace it in Task 8.)

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: `✓ Compiled successfully`. The `/admin/wrong-answers` route appears in the route list.

- [ ] **Step 5: Commit**

```bash
git add app/admin/wrong-answers/page.tsx components/admin/wrong-answers-table.tsx components/admin/wrong-answer-resolve-modal.tsx app/admin/layout.tsx
git commit -m "feat(admin): wrong-answers review queue page + nav"
```

---

## Task 5: LLM draft-fix module + endpoint

**Files:**
- Create: `lib/llm/draft-kb-fix.ts`
- Create: `app/api/admin/wrong-answers/[id]/draft-fix/route.ts`
- Create: `tests/lib/llm/draft-kb-fix.test.ts`

- [ ] **Step 1: Write the failing test** (pure parsing logic — mock the LLM)

```ts
// tests/lib/llm/draft-kb-fix.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('ai', () => ({
  generateText: vi.fn(async () => ({
    text: JSON.stringify({
      action: 'edit',
      target_kb_id: '11111111-1111-1111-1111-111111111111',
      draft: { question_variants: ['Does Dalgo do qualitative analysis?'], canonical_answer: 'No, not as of now.', status: 'no', evidence: [] },
    }),
  })),
}));
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: () => 'model' }));

describe('draftKbFix', () => {
  it('returns a parsed edit-or-create draft', async () => {
    const { draftKbFix } = await import('@/lib/llm/draft-kb-fix');
    const out = await draftKbFix({
      question: 'does dalgo do qualitative analysis?',
      wrongAnswer: 'Yes, Dalgo does qualitative analysis.',
      reason: 'It does not.',
      suggestedAnswer: 'No, not as of now.',
      candidates: [{ kb_id: '11111111-1111-1111-1111-111111111111', question: 'qual?', snippet: 'Dalgo can...' }],
    });
    expect(out.action).toBe('edit');
    expect(out.target_kb_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(out.draft.status).toBe('no');
    expect(out.draft.canonical_answer).toContain('No');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/lib/llm/draft-kb-fix.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/llm/draft-kb-fix.ts`**

```ts
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export interface DraftCandidate { kb_id: string; question: string; snippet: string }

export interface DraftFixInput {
  question: string;          // the user's original question
  wrongAnswer: string;       // the assistant answer reported as wrong
  reason: string;            // admin's "what's wrong"
  suggestedAnswer?: string;  // admin's optional correct answer
  candidates: DraftCandidate[]; // KB entries that fed the answer (from retrieval trace)
}

export interface KbDraft {
  question_variants: string[];
  canonical_answer: string;
  status: 'yes' | 'partial' | 'no' | 'roadmap';
  ngo_framing?: string | null;
  evidence?: string[];
  notes_for_sales?: string | null;
}

export interface DraftFixResult {
  action: 'edit' | 'create';
  target_kb_id?: string; // present when action==='edit'
  draft: KbDraft;
}

export async function draftKbFix(input: DraftFixInput): Promise<DraftFixResult> {
  const candidateBlock = input.candidates.length
    ? input.candidates.map((c, i) => `${i + 1}. [kb_id=${c.kb_id}] Q: ${c.question}\n   A: ${c.snippet}`).join('\n')
    : '(no KB entries fed this answer)';

  const prompt = `You maintain the knowledge base for a chatbot that helps NGO leaders evaluate Dalgo.
An admin reported a wrong answer. Produce a corrected KB entry.

ORIGINAL QUESTION: ${input.question}
WRONG ANSWER GIVEN: ${input.wrongAnswer}
WHY IT'S WRONG (admin): ${input.reason}
ADMIN'S SUGGESTED CORRECT ANSWER (may be empty): ${input.suggestedAnswer ?? ''}

KB ENTRIES THAT FED THIS ANSWER:
${candidateBlock}

Decide:
- If one of the KB entries above contains the wrong information, action="edit" and set target_kb_id to that entry's kb_id. Rewrite that entry correctly.
- If no existing entry covers this, action="create" a new entry.

Honesty rules: if Dalgo does NOT do something, status must be "no" and the answer must say so plainly. Never invent customers or URLs. If the admin gave a suggested answer, base the corrected answer on it.

Return ONLY this JSON (no markdown):
{ "action": "edit"|"create", "target_kb_id": "<uuid or omit>", "draft": { "question_variants": ["..."], "canonical_answer": "...", "status": "yes"|"partial"|"no"|"roadmap", "ngo_framing": null, "evidence": [], "notes_for_sales": null } }`;

  const { text } = await generateText({ model: anthropic('claude-sonnet-4-6'), prompt, maxTokens: 1500 });
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(cleaned) as DraftFixResult;

  // Normalize / guard
  if (parsed.action !== 'edit') parsed.action = parsed.action === 'create' ? 'create' : 'create';
  if (parsed.action === 'create') delete parsed.target_kb_id;
  parsed.draft.question_variants = (parsed.draft.question_variants ?? []).filter((s) => s && s.trim());
  if (parsed.draft.question_variants.length === 0) parsed.draft.question_variants = [input.question];
  if (!['yes', 'partial', 'no', 'roadmap'].includes(parsed.draft.status)) parsed.draft.status = 'no';
  parsed.draft.evidence = parsed.draft.evidence ?? [];
  return parsed;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/lib/llm/draft-kb-fix.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the endpoint** `app/api/admin/wrong-answers/[id]/draft-fix/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';
import { draftKbFix, type DraftCandidate } from '@/lib/llm/draft-kb-fix';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Trace = { fused_top12?: Array<{ id: string; source: string; preview?: string }> };

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  const { rows } = await query<{
    reason: string; suggested_answer: string | null; retrieval_trace_snap: Trace | null;
    answer_text: string; session_id: string; message_id: string;
  }>(
    `SELECT w.reason, w.suggested_answer, w.retrieval_trace_snap,
            (m.content->>'text') AS answer_text, m.session_id, w.message_id
       FROM wrong_answer_reports w JOIN messages m ON m.id = w.message_id
      WHERE w.id = $1`,
    [id],
  );
  if (!rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const rep = rows[0];

  // The original question = the most recent user message before this assistant message.
  const q = await query<{ text: string }>(
    `SELECT (content->>'text') AS text FROM messages
      WHERE session_id = $1 AND role = 'user'
        AND created_at < (SELECT created_at FROM messages WHERE id = $2)
      ORDER BY created_at DESC LIMIT 1`,
    [rep.session_id, rep.message_id],
  );
  const question = q.rows[0]?.text ?? '';

  // Candidate KB entries from the trace snapshot (kb_curated sources).
  const ids = (rep.retrieval_trace_snap?.fused_top12 ?? [])
    .filter((c) => c.source === 'kb_curated').slice(0, 5).map((c) => c.id);
  let candidates: DraftCandidate[] = [];
  if (ids.length) {
    const kb = await query<{ id: string; question_variants: string[]; canonical_answer: string }>(
      `SELECT id, question_variants, canonical_answer FROM dalgo_knowledge_base WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    candidates = kb.rows.map((r) => ({ kb_id: r.id, question: r.question_variants?.[0] ?? '', snippet: (r.canonical_answer ?? '').slice(0, 200) }));
  }

  const draft = await draftKbFix({
    question, wrongAnswer: rep.answer_text, reason: rep.reason,
    suggestedAnswer: rep.suggested_answer ?? undefined, candidates,
  });
  return NextResponse.json({ ...draft, question });
}
```

- [ ] **Step 6: Verify build + commit**

Run: `npm run build` → Expected: success.
```bash
git add lib/llm/draft-kb-fix.ts app/api/admin/wrong-answers/[id]/draft-fix/route.ts tests/lib/llm/draft-kb-fix.test.ts
git commit -m "feat(wrong-answers): LLM draft-fix module + endpoint"
```

---

## Task 6: `answer_must_convey` llm-judge criterion (for regression cases)

**Files:**
- Modify: `lib/llm/eval/cases/types.ts` (add key to `expected`)
- Modify: `lib/llm/eval/judges/llm-judge.ts` (score the new key)
- Create: `tests/lib/llm/eval/answer-must-convey.test.ts`

- [ ] **Step 1: Write the failing test** (mock the model's JSON verdict)

```ts
// tests/lib/llm/eval/answer-must-convey.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('ai', () => ({
  generateText: vi.fn(async () => ({ text: JSON.stringify({ structure_pass: true, uncertainty_pass: true, convey_pass: false, reason: 'did not state it' }) })),
}));
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: () => 'model' }));

describe('llm-judge answer_must_convey', () => {
  it('fails when the model says the answer did not convey the required point', async () => {
    const { llmJudge } = await import('@/lib/llm/eval/judges/llm-judge');
    const res = await llmJudge({
      case: { id: 'x', input: 'q', expected: { answer_must_convey: 'Dalgo does not do qualitative analysis' } } as any,
      response: 'Yes Dalgo does qualitative analysis.',
      trace: { fused_top12: [], candidates: { blogs: [], patterns: [], kb: [] } } as any,
    });
    expect(res.pass).toBe(false);
  });
});
```

(Match the actual `llmJudge` input/return shape in `lib/llm/eval/judges/llm-judge.ts`; the call above mirrors `retrievalJudge`'s `{ case, response, trace }`. If `llmJudge` runs multiple votes, the single mocked verdict applies to each.)

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/lib/llm/eval/answer-must-convey.test.ts`
Expected: FAIL — `convey_pass` not part of the prompt/aggregation yet, so `pass` is `true`.

- [ ] **Step 3: Add the type key** in `lib/llm/eval/cases/types.ts` inside the `expected: { ... }` object:

```ts
    /** A point the answer must clearly convey (semantic; judged by the LLM). */
    answer_must_convey?: string;
```

- [ ] **Step 4: Extend the llm-judge.** In `lib/llm/eval/judges/llm-judge.ts`:
  - Add to the JSON instructions in the prompt: `- convey_pass: only relevant if expected.answer_must_convey is set. Passes if the response clearly conveys: "<the value>".` Interpolate the value when present.
  - Add to the aggregation boolean: `(input.case.expected.answer_must_convey ? parsed.convey_pass : true)`.

Concretely, where the prompt template builds criteria, append when set:
```ts
const conveyLine = input.case.expected.answer_must_convey
  ? `\n- convey_pass: passes if the response clearly conveys this point: "${input.case.expected.answer_must_convey}". Fails if it contradicts or omits it.`
  : '';
```
Include `${conveyLine}` in the prompt's criteria list, and extend the pass expression already present (the `&&` chain at ~line 67) with the `convey_pass` clause above.

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- tests/lib/llm/eval/answer-must-convey.test.ts`
Expected: PASS. Also run the existing llm-judge tests to ensure no regression: `npm test -- tests/lib/llm/eval`.

- [ ] **Step 6: Commit**

```bash
git add lib/llm/eval/cases/types.ts lib/llm/eval/judges/llm-judge.ts tests/lib/llm/eval/answer-must-convey.test.ts
git commit -m "feat(eval): answer_must_convey criterion for llm-judge"
```

---

## Task 7: KB write helpers (transaction-aware)

**Files:**
- Modify: `lib/db/queries/kb.ts` (add `insertKbEntryTx`, `versionAndUpdateKbTx`)
- Create: `tests/lib/db/kb-write-helpers.test.ts`

These wrap the exact create/version+update logic from the existing routes so the resolve endpoint (Task 8) can run all writes in one transaction. They accept a `PoolClient`. The embedding (an async OpenAI call) is computed by the caller BEFORE the transaction and passed in as a vector literal.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/db/kb-write-helpers.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { pool, withClient, query } from '@/lib/db/client';
import { insertKbEntryTx, versionAndUpdateKbTx } from '@/lib/db/queries/kb';

const vec = `[${Array(1536).fill(0).join(',')}]`;

describe('kb write helpers', () => {
  it('insertKbEntryTx creates an entry with provenance', async () => {
    const id = await withClient((c) => insertKbEntryTx(c, {
      category: 'ai', question_variants: ['q1'], canonical_answer: 'a1', status: 'no',
      ngo_framing: null, evidence: [], notes_for_sales: null,
      embeddingLiteral: vec, source: 'wrong_answer_fix', source_message_id: null, author_email: 'a@b.com',
    }));
    const { rows } = await query(`SELECT source, status FROM dalgo_knowledge_base WHERE id=$1`, [id]);
    expect(rows[0].source).toBe('wrong_answer_fix');
    expect(rows[0].status).toBe('no');
    await query(`DELETE FROM dalgo_knowledge_base WHERE id=$1`, [id]);
  });

  it('versionAndUpdateKbTx snapshots prior + updates', async () => {
    const id = await withClient((c) => insertKbEntryTx(c, {
      category: 'ai', question_variants: ['q'], canonical_answer: 'old', status: 'yes',
      ngo_framing: null, evidence: [], notes_for_sales: null,
      embeddingLiteral: vec, source: 'admin_manual', source_message_id: null, author_email: 'a@b.com',
    }));
    await withClient((c) => versionAndUpdateKbTx(c, id, {
      question_variants: ['q'], canonical_answer: 'new', status: 'no',
    }, 'a@b.com', vec));
    const cur = await query<{ canonical_answer: string; status: string }>(`SELECT canonical_answer, status FROM dalgo_knowledge_base WHERE id=$1`, [id]);
    expect(cur.rows[0].canonical_answer).toBe('new');
    const ver = await query<{ c: number }>(`SELECT COUNT(*)::int c FROM dalgo_kb_versions WHERE kb_id=$1`, [id]);
    expect(ver.rows[0].c).toBe(1); // prior 'old' snapshot
    await query(`DELETE FROM dalgo_knowledge_base WHERE id=$1`, [id]);
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/lib/db/kb-write-helpers.test.ts`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Add the helpers** to `lib/db/queries/kb.ts`

```ts
import type { PoolClient } from 'pg';

export interface KbInsert {
  category: string;
  question_variants: string[];
  canonical_answer: string;
  status: 'yes' | 'partial' | 'no' | 'roadmap';
  ngo_framing: string | null;
  evidence: string[];
  notes_for_sales: string | null;
  embeddingLiteral: string;            // `[..1536..]`
  source: string;                       // e.g. 'wrong_answer_fix'
  source_message_id: string | null;
  author_email: string | null;
}

export async function insertKbEntryTx(client: PoolClient, e: KbInsert): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO dalgo_knowledge_base
       (category, question_variants, canonical_answer, status, ngo_framing, evidence,
        notes_for_sales, embedding, last_verified, source, source_message_id, author_email)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::vector, now(), $9,$10,$11)
     RETURNING id`,
    [e.category, e.question_variants, e.canonical_answer, e.status, e.ngo_framing,
     e.evidence, e.notes_for_sales, e.embeddingLiteral, e.source, e.source_message_id, e.author_email],
  );
  return rows[0].id;
}

export interface KbUpdate {
  question_variants: string[];
  canonical_answer: string;
  status: 'yes' | 'partial' | 'no' | 'roadmap';
  ngo_framing?: string | null;
  evidence?: string[];
  notes_for_sales?: string | null;
}

export async function versionAndUpdateKbTx(
  client: PoolClient, id: string, patch: KbUpdate, updatedBy: string, embeddingLiteral: string,
): Promise<void> {
  const cur = await client.query(
    `SELECT category, question_variants, canonical_answer, status, ngo_framing, evidence, notes_for_sales
       FROM dalgo_knowledge_base WHERE id=$1 FOR UPDATE`, [id]);
  if (cur.rows.length === 0) throw new Error('kb entry not found');
  const prev = cur.rows[0];
  await client.query(
    `INSERT INTO dalgo_kb_versions
       (kb_id, category, question_variants, canonical_answer, status, ngo_framing, evidence, notes_for_sales, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, prev.category, prev.question_variants, prev.canonical_answer, prev.status,
     prev.ngo_framing, prev.evidence ?? [], prev.notes_for_sales, updatedBy]);
  await client.query(
    `UPDATE dalgo_knowledge_base
        SET question_variants=$1, canonical_answer=$2, status=$3,
            ngo_framing=$4, evidence=$5, notes_for_sales=$6,
            embedding=$7::vector, last_verified=now(), updated_at=now()
      WHERE id=$8`,
    [patch.question_variants, patch.canonical_answer, patch.status,
     patch.ngo_framing ?? prev.ngo_framing, patch.evidence ?? prev.evidence ?? [],
     patch.notes_for_sales ?? prev.notes_for_sales, embeddingLiteral, id]);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/lib/db/kb-write-helpers.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/kb.ts tests/lib/db/kb-write-helpers.test.ts
git commit -m "feat(kb): transaction-aware insert/version-update helpers"
```

---

## Task 8: Resolve endpoint + resolve modal

**Files:**
- Create: `app/api/admin/wrong-answers/[id]/resolve/route.ts`
- Create: `components/admin/wrong-answer-resolve-modal.tsx` (replaces the Task 4 stub)
- Create: `tests/api/admin/wrong-answers-resolve.test.ts`

### 8a — Resolve endpoint

The endpoint accepts the admin-approved draft and an `action`. It: embeds (outside the txn), then in ONE transaction writes the KB (create or edit), optionally creates an eval case, and flips the report to `resolved`. After commit it re-runs retrieval to confirm. A `dismiss` action just sets status.

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/admin/wrong-answers-resolve.test.ts
import { describe, it, expect, vi, afterAll, beforeAll } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => ({ user: { email: 'admin@dalgo.org' } })) }));
vi.mock('@/lib/embeddings', () => ({ embed: vi.fn(async () => Array(1536).fill(0)) }));
vi.mock('@/lib/llm/rag/pipeline', () => ({ runPipeline: vi.fn(async () => ({ topPassages: [{ id: 'KBID' }], trace: {} })) }));

const SID = '00000000-0000-0000-0000-0000000000d4';
let reportId: number;

beforeAll(async () => {
  await query(`INSERT INTO sessions (id) VALUES ($1) ON CONFLICT DO NOTHING`, [SID]);
  await query(`INSERT INTO messages (session_id, role, content) VALUES ($1,'user','{"text":"does dalgo do qual?"}'::jsonb)`, [SID]);
  const a = await query<{ id: string }>(`INSERT INTO messages (session_id, role, content) VALUES ($1,'assistant','{"text":"yes"}'::jsonb) RETURNING id`, [SID]);
  const r = await query<{ id: number }>(`INSERT INTO wrong_answer_reports (message_id, reason, reported_by, status) VALUES ($1,'wrong','admin@dalgo.org','pending') RETURNING id`, [a.rows[0].id]);
  reportId = r.rows[0].id;
});

describe('POST resolve', () => {
  it('creates a KB entry, an eval case, and marks the report resolved', async () => {
    const { POST } = await import(`@/app/api/admin/wrong-answers/[id]/resolve/route`);
    const body = {
      action: 'create',
      draft: { category: 'ai', question_variants: ['does dalgo do qual?'], canonical_answer: 'No, not as of now.', status: 'no', evidence: [] },
      add_eval_case: true,
    };
    const req = new Request('http://t', { method: 'POST', body: JSON.stringify(body) });
    const res = await POST(req as any, { params: Promise.resolve({ id: String(reportId) }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.fixed_kb_id).toBeTruthy();

    const rep = await query<{ status: string; fix_kind: string; fixed_kb_id: string }>(`SELECT status, fix_kind, fixed_kb_id FROM wrong_answer_reports WHERE id=$1`, [reportId]);
    expect(rep.rows[0].status).toBe('resolved');
    expect(rep.rows[0].fix_kind).toBe('created');

    const ec = await query<{ c: number }>(`SELECT COUNT(*)::int c FROM dalgo_eval_cases WHERE case_key=$1`, [`wrong-answer-fix-${reportId}`]);
    expect(ec.rows[0].c).toBe(1);

    // cleanup eval case + kb
    await query(`DELETE FROM dalgo_eval_cases WHERE case_key=$1`, [`wrong-answer-fix-${reportId}`]);
    await query(`DELETE FROM dalgo_knowledge_base WHERE id=$1`, [rep.rows[0].fixed_kb_id]);
  });

  afterAll(async () => {
    await query(`DELETE FROM sessions WHERE id=$1`, [SID]);
    await pool().end();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/api/admin/wrong-answers-resolve.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement `app/api/admin/wrong-answers/[id]/resolve/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, withClient } from '@/lib/db/client';
import { embed } from '@/lib/embeddings';
import { insertKbEntryTx, versionAndUpdateKbTx } from '@/lib/db/queries/kb';
import { runPipeline } from '@/lib/llm/rag/pipeline';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Draft = z.object({
  category: z.string(),
  question_variants: z.array(z.string().min(1)).min(1),
  canonical_answer: z.string().min(1),
  status: z.enum(['yes', 'partial', 'no', 'roadmap']),
  ngo_framing: z.string().nullable().optional(),
  evidence: z.array(z.string()).optional(),
  notes_for_sales: z.string().nullable().optional(),
});
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('dismiss') }),
  z.object({ action: z.literal('create'), draft: Draft, add_eval_case: z.boolean().default(true) }),
  z.object({ action: z.literal('edit'), target_kb_id: z.string().uuid(), draft: Draft, add_eval_case: z.boolean().default(true) }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const email = session.user.email ?? 'admin';
  const { id } = await params;

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'invalid body', detail: String(e) }, { status: 400 }); }

  // Load report + the assistant message + original user question.
  const rep = await query<{ message_id: string; session_id: string }>(
    `SELECT w.message_id, m.session_id FROM wrong_answer_reports w JOIN messages m ON m.id=w.message_id WHERE w.id=$1`,
    [id]);
  if (!rep.rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (body.action === 'dismiss') {
    await query(`UPDATE wrong_answer_reports SET status='dismissed', resolved_by=$1, resolved_at=now() WHERE id=$2`, [email, id]);
    return NextResponse.json({ ok: true, status: 'dismissed' });
  }

  const qrow = await query<{ text: string }>(
    `SELECT (content->>'text') AS text FROM messages
      WHERE session_id=$1 AND role='user' AND created_at < (SELECT created_at FROM messages WHERE id=$2)
      ORDER BY created_at DESC LIMIT 1`, [rep.rows[0].session_id, rep.rows[0].message_id]);
  const question = qrow.rows[0]?.text ?? body.draft.question_variants[0];

  // Embed BEFORE the transaction (network call).
  const vec = await embed(`${body.draft.question_variants.join(' | ')}\n\n${body.draft.canonical_answer}`);
  const vecLit = `[${vec.join(',')}]`;

  const fixedKbId = await withClient<string>(async (client) => {
    await client.query('BEGIN');
    try {
      let kbId: string;
      if (body.action === 'create') {
        kbId = await insertKbEntryTx(client, {
          category: body.draft.category,
          question_variants: body.draft.question_variants,
          canonical_answer: body.draft.canonical_answer,
          status: body.draft.status,
          ngo_framing: body.draft.ngo_framing ?? null,
          evidence: body.draft.evidence ?? [],
          notes_for_sales: body.draft.notes_for_sales ?? null,
          embeddingLiteral: vecLit, source: 'wrong_answer_fix',
          source_message_id: rep.rows[0].message_id, author_email: email,
        });
      } else {
        kbId = body.target_kb_id;
        await versionAndUpdateKbTx(client, kbId, {
          question_variants: body.draft.question_variants,
          canonical_answer: body.draft.canonical_answer,
          status: body.draft.status,
          ngo_framing: body.draft.ngo_framing,
          evidence: body.draft.evidence,
          notes_for_sales: body.draft.notes_for_sales,
        }, email, vecLit);
      }

      if (body.add_eval_case) {
        await client.query(
          `INSERT INTO dalgo_eval_cases (case_key, bucket, input, expected, judges, enabled, notes, updated_by)
           VALUES ($1,$2,$3,$4::jsonb,$5,true,$6,$7)
           ON CONFLICT (case_key) DO UPDATE SET input=EXCLUDED.input, expected=EXCLUDED.expected, updated_by=EXCLUDED.updated_by, updated_at=now()`,
          [`wrong-answer-fix-${id}`, 'wrong_answer_fix', question,
           JSON.stringify({ answer_must_convey: body.draft.canonical_answer.slice(0, 300) }),
           ['llm-judge'], `Auto-created from wrong-answer report ${id}`, email]);
      }

      await client.query(
        `UPDATE wrong_answer_reports
            SET status='resolved', fixed_kb_id=$1, fix_kind=$2, resolved_by=$3, resolved_at=now()
          WHERE id=$4`,
        [kbId, body.action === 'create' ? 'created' : 'edited', email, id]);

      await client.query('COMMIT');
      return kbId;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* original error is more useful */ }
      throw err;
    }
  });

  // Verify retrieval now surfaces the fixed entry (read-only, post-commit).
  let verified = false;
  try {
    const pr = await runPipeline(question);
    verified = pr.topPassages.some((p) => p.id === fixedKbId);
  } catch { /* verification is best-effort */ }

  return NextResponse.json({ ok: true, status: 'resolved', fixed_kb_id: fixedKbId, verified, question });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/api/admin/wrong-answers-resolve.test.ts`
Expected: PASS.

### 8b — Resolve modal

- [ ] **Step 5: Implement `components/admin/wrong-answer-resolve-modal.tsx`** (replaces the Task 4 stub)

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Draft = {
  category: string; question_variants: string[]; canonical_answer: string;
  status: 'yes' | 'partial' | 'no' | 'roadmap'; ngo_framing?: string | null;
  evidence?: string[]; notes_for_sales?: string | null;
};

export function WrongAnswerResolveModal({ reportId, onClose }: { reportId: number; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<'edit' | 'create'>('create');
  const [targetKbId, setTargetKbId] = useState<string | undefined>();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [addEval, setAddEval] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ fixed_kb_id: string; verified: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/wrong-answers/${reportId}/draft-fix`, { method: 'POST' });
      if (!res.ok) { setError(`Draft failed: HTTP ${res.status}`); setLoading(false); return; }
      const j = await res.json();
      setAction(j.action); setTargetKbId(j.target_kb_id);
      setDraft({ category: 'ai', ...j.draft }); setLoading(false);
    })();
  }, [reportId]);

  async function approve() {
    if (!draft) return;
    setBusy(true); setError(null);
    const payload = action === 'edit'
      ? { action: 'edit', target_kb_id: targetKbId, draft, add_eval_case: addEval }
      : { action: 'create', draft, add_eval_case: addEval };
    const res = await fetch(`/api/admin/wrong-answers/${reportId}/resolve`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { setError(`Approve failed: HTTP ${res.status}`); return; }
    setResult(await res.json());
  }

  async function dismiss() {
    setBusy(true);
    await fetch(`/api/admin/wrong-answers/${reportId}/resolve`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'dismiss' }) });
    setBusy(false); onClose();
  }

  async function runEval() {
    // single-case run via the existing eval-case test endpoint (confirm exact path in code:
    // see tests/api/admin/eval-case-test.test.ts). Falls back to the runs page link.
    window.open('/admin/evals', '_blank');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="max-h-[90vh] w-[90vw] max-w-2xl space-y-3 overflow-y-auto rounded-lg border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-foreground">Review &amp; fix</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {loading && <p className="text-sm text-muted-foreground">Drafting a fix…</p>}

        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              KB {action === 'edit' ? 'updated' : 'created'}. Retrieval re-check:{' '}
              {result.verified ? '✓ fixed entry now ranks top' : '⚠ fixed entry did not surface — review the entry'}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={runEval}>Run eval now</Button>
              <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : draft ? (
          <div className="space-y-3">
            <div className="flex gap-2 text-sm">
              <button onClick={() => setAction('create')} className={`rounded px-2 py-1 ${action === 'create' ? 'bg-primary text-white' : 'bg-muted'}`}>Create new</button>
              <button onClick={() => setAction('edit')} disabled={!targetKbId} className={`rounded px-2 py-1 ${action === 'edit' ? 'bg-primary text-white' : 'bg-muted'} disabled:opacity-40`}>Edit existing</button>
            </div>
            <label className="block text-xs text-muted-foreground">Question variants (one per line)</label>
            <textarea rows={3} className="w-full rounded border border-border bg-card p-2 text-sm"
              value={draft.question_variants.join('\n')}
              onChange={(e) => setDraft({ ...draft, question_variants: e.target.value.split('\n').filter(Boolean) })} />
            <label className="block text-xs text-muted-foreground">Corrected answer</label>
            <textarea rows={6} className="w-full rounded border border-border bg-card p-2 text-sm"
              value={draft.canonical_answer} onChange={(e) => setDraft({ ...draft, canonical_answer: e.target.value })} />
            <label className="block text-xs text-muted-foreground">Status</label>
            <select className="rounded border border-border bg-card p-1 text-sm" value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft['status'] })}>
              {['yes', 'partial', 'no', 'roadmap'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={addEval} onChange={(e) => setAddEval(e.target.checked)} /> Add eval case (regression test)
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={dismiss} disabled={busy}>Dismiss (not wrong)</Button>
              <Button variant="primary" size="sm" onClick={approve} disabled={busy}>{busy ? 'Approving…' : 'Approve → update KB'}</Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify build + run all new tests**

Run: `npm run build` → success.
Run: `npm test -- tests/api/admin/wrong-answers-resolve.test.ts tests/lib/db/kb-write-helpers.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/wrong-answers/[id]/resolve/route.ts components/admin/wrong-answer-resolve-modal.tsx tests/api/admin/wrong-answers-resolve.test.ts
git commit -m "feat(wrong-answers): transactional resolve endpoint + review/fix modal"
```

---

## Task 9: Wire "Run eval now" to a single-case run (optional, confirm endpoint)

**Files:**
- Modify: `components/admin/wrong-answer-resolve-modal.tsx` (`runEval`)
- Reference: `tests/api/admin/eval-case-test.test.ts` (existing single-case run endpoint)

- [ ] **Step 1: Find the single-case run endpoint**

Run: `grep -rn "eval-case\|/test\b\|case_key\|case_id" app/api/admin --include=route.ts | grep -i test`
Read the route the test `tests/api/admin/eval-case-test.test.ts` exercises to get its exact path + request shape.

- [ ] **Step 2: Update `runEval`** to call that endpoint with `case_key = \`wrong-answer-fix-${reportId}\`` (or the case id returned). Show the pass/fail result inline. If no single-case endpoint exists, leave the current `window.open('/admin/evals')` behavior and note it in the journal.

- [ ] **Step 3: Verify build + commit**

```bash
npm run build
git add components/admin/wrong-answer-resolve-modal.tsx
git commit -m "feat(wrong-answers): run-eval-now triggers single-case eval"
```

---

## Task 10: Journal + full regression

**Files:**
- Modify: `docs/JOURNAL.md`

- [ ] **Step 1: Run the full non-eval suite**

Run: `npm test -- tests/lib tests/api`
Expected: all pass (the eval LLM suite under `tests/llm` is excluded — it calls live APIs).

- [ ] **Step 2: Append a JOURNAL entry** using the project template (Added / Removed / Why / Eval delta / Carried forward) summarizing the wrong-answer review queue + LLM-assisted KB fix loop.

- [ ] **Step 3: Commit**

```bash
git add docs/JOURNAL.md
git commit -m "docs(journal): wrong-answer review queue + KB fix loop"
```

---

## Self-review checklist (completed during planning)

- **Spec coverage:** mark-wrong + suggested_answer (T2), review queue page+endpoint (T3,T4), LLM draft edit-vs-create (T5), approve→KB write re-embed+version (T7,T8), atomic resolve (T8), re-run verification (T8), eval case auto-create + optional run (T8,T9), dismiss (T8), data model (T1), durability via DB (no seed write — out of scope per spec). ✔
- **Placeholder scan:** Task 9 contains a deliberate lookup step (single-case eval endpoint) because its exact path must be confirmed in code; the fallback behavior is specified so it is not a blocking gap.
- **Type consistency:** `insertKbEntryTx`/`versionAndUpdateKbTx` signatures match between Task 7 and Task 8; `KbDraft`/`Draft` fields align across draft-fix (T5) and resolve (T8); `answer_must_convey` added in T6 is the key the eval case writes in T8.
