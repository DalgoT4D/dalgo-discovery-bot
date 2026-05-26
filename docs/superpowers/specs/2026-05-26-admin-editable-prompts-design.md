# Admin-editable prompts + wrong-answer feedback loop — design

**Status:** approved 2026-05-26 (brainstorm)
**Branch:** `feat/blog-ingestion`
**Author context:** Path A from `HANDOFF.md`; the biggest pending feature on the RAG-upgrade branch.

## Problem

The Discovery Bot's behavior is governed by a single ~70-line system prompt hardcoded in `lib/llm/system-prompt.ts`. Today, every editorial change (tightening the "no fake customers" rule, adjusting the Dalgo-vs-3rd-party boundary, rephrasing fit-assessment flow) requires:

1. An engineer to open the file and edit the string
2. A code review
3. A redeploy

The product/consultant team — the people who actually know whether the bot's tone, framing, or boundary-handling is right — cannot fix the bot themselves. The most recent fix (`a9b8ed0`) caught two real hallucinations and took most of an afternoon partly because the rule that prevented them had to be expressed as a new prompt section by an engineer.

The second symptom: when a wrong answer ships, there is no in-product feedback loop. Admins can already promote good answers to KB and view retrieval debug, but cannot say "this specific answer was wrong — here's why, here's the KB entry that misled it, let me fix that entry."

## Goals

1. **Editable prompts from the admin UI.** The product team can change any of 5 prompt sections at `/admin/prompts` and have the next chat request reflect it without a redeploy.
2. **Wrong-answer fix workflow.** From `/admin/conversations/[id]`, an admin can flag any assistant message as wrong, see the KB rows that produced it (via `retrieval_trace`), and edit the offending row inline.
3. **Audit trail.** Every prompt save is versioned; every wrong-answer report is logged. Mistakes are recoverable and recurring failure modes become visible over time.
4. **Zero behavior change in the chat surface.** Initial DB content for the 5 prompt sections is the current `staticSystem()` split verbatim. Eval score (45/50) must hold.

## Non-goals (v1)

- Per-user permission tiers — all admin users can edit (matches existing admin model)
- One-click "Restore this version" — admin copies content from the diff modal manually
- A dashboard / queue UI over `wrong_answer_reports` — the table is persisted for future use, but the only v1 read surface is the in-line modal flow
- Dependency checks at save time (e.g., warning that a prompt references a removed tool name)
- Anthropic prompt-cache eviction strategy beyond what already happens naturally (content-addressed, re-warms on first request after a save)

## Architecture

### Data layer (3 new tables)

```sql
CREATE TABLE dalgo_prompts (
  key         text PRIMARY KEY,
  content     text NOT NULL,
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dalgo_prompt_versions (
  id          bigserial PRIMARY KEY,
  prompt_key  text NOT NULL REFERENCES dalgo_prompts(key) ON DELETE CASCADE,
  content     text NOT NULL,
  updated_by  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prompt_versions_key_idx
  ON dalgo_prompt_versions (prompt_key, updated_at DESC);

CREATE TABLE wrong_answer_reports (
  id                   bigserial PRIMARY KEY,
  message_id           uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reason               text NOT NULL,
  retrieval_trace_snap jsonb,
  fixed_kb_id          uuid REFERENCES dalgo_knowledge_base(id) ON DELETE SET NULL,
  reported_by          text NOT NULL,
  reported_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wrong_answer_reports_msg_idx ON wrong_answer_reports (message_id);
```

**Seed rows** for `dalgo_prompts`, in order:

| key                    | source in current `staticSystem()`                                  |
|------------------------|---------------------------------------------------------------------|
| `intro_and_rules`      | Lines 2-23 (identity + rules 1-10 + citation discipline)            |
| `tools_inventory`      | The "You have:" bullet list (lines 4-8) — broken out so non-engineers can update tool names without touching identity copy. Note: this overlaps the intro block in the current source; the split lifts these 5 lines out so they live in exactly one section. |
| `consultant_mode`      | The `## Consultant mode` section                                    |
| `dalgo_vs_3rd_party`   | The `## Hard boundary` section (the recent `a9b8ed0` fix)           |
| `fit_assessment`       | The `## Fit Assessment Mode` section                                |

The seed inserts both the `dalgo_prompts` rows AND a matching `dalgo_prompt_versions` row per section, so version history starts at v1 instead of being empty after the first edit.

**Migration handling.** Per `CLAUDE.md`'s schema-drift note, we add the tables to `lib/db/schema.sql` AND ship a one-shot migration at `scripts/migrations/001_prompts.sql` that the user runs against the live container — so `docker compose down -v` + `psql < schema.sql` continues to work AND the running DB picks up the change without a destructive reset.

### Prompt assembly (`lib/llm/prompts.ts`)

A new module with:

- `getPrompt(key: string): Promise<string>` — in-memory cache with 60s TTL. Cache miss → SELECT one row → cache → return. Missing key throws (fail loud — a broken prompt key is a deploy bug, not a runtime degradation).
- `invalidatePromptCache(key?: string): void` — clears one or all entries; bumps a module-level `version` counter (useful for future debugging / log correlation).

`staticSystem()` becomes `async` and assembles in parallel:

```ts
const [intro, tools, consultant, boundary, fit] = await Promise.all([
  getPrompt('intro_and_rules'),
  getPrompt('tools_inventory'),
  getPrompt('consultant_mode'),
  getPrompt('dalgo_vs_3rd_party'),
  getPrompt('fit_assessment'),
]);
return [intro, tools, consultant, boundary, fit].join('\n\n');
```

**Callers that need `await`:**
- `app/api/chat/route.ts:114` (already async — trivial)
- `lib/llm/eval/runner.ts:64` (`buildSystemPrompt`) and `:154` (direct `staticSystem`) — both must await; `buildSystemPrompt` itself becomes async.

**Anthropic prompt-cache interaction.** Anthropic's `cacheControl: ephemeral` is content-addressed. Our 60s TTL means:
- Within a TTL window, identical assembled string → Anthropic cache stays warm.
- After a save in this process, `invalidatePromptCache(key)` makes the next request rebuild → Anthropic cache misses ONCE → re-warms.
- If we ever scale to multiple Next.js instances, other instances refresh within 60s. Worst case: 60s of mixed-version prompts across the fleet. Acceptable for an editorial tool used a handful of times per week.

### Admin API routes

All under `/api/admin/*`, gated by the existing `auth()` helper. Same auth model as Leads / KB / Blogs.

**Prompts CRUD:**

| Method + path                                  | Purpose                                                                                                                                      |
|------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| `GET /api/admin/prompts`                       | Returns all 5 `{key, content, updated_by, updated_at}`                                                                                       |
| `GET /api/admin/prompts/[key]`                 | Returns one section                                                                                                                          |
| `PUT /api/admin/prompts/[key]`                 | Body `{content}`. Single transaction: `UPDATE dalgo_prompts` + `INSERT dalgo_prompt_versions`. Then `invalidatePromptCache(key)`. Returns updated row. |
| `GET /api/admin/prompts/[key]/versions`        | Returns history desc by `updated_at`                                                                                                         |

**Wrong-answer reports + KB editing:**

| Method + path                          | Purpose                                                                                                                                                          |
|----------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `POST /api/admin/wrong-answers`        | Body `{message_id, reason}`. Server fetches `messages.retrieval_trace` for that id, snapshots it into `retrieval_trace_snap`, inserts row, returns `{id, candidates: [{kb_id, question, score, snippet}, ...]}` parsed from the trace. |
| `PATCH /api/admin/wrong-answers/[id]`  | Body `{fixed_kb_id}`. Sets which KB row the admin ended up fixing.                                                                                               |
| `GET /api/admin/kb/[id]`               | Existing route. Confirm returns full row including `question_variants` and `evidence`.                                                                            |
| `PUT /api/admin/kb/[id]`               | Existing route. Add: after save, call `embed(question_variants.join(' | ') + ' | ' + canonical_answer)` from `lib/embeddings.ts` (already exists) and UPDATE the `embedding` column. Matches what `scripts/reembed-kb-row.ts` does — that script becomes a thin CLI wrapper over a shared helper if we want to dedupe, or stays as-is. |

**Retrieval-trace shape.** Confirmed at `lib/llm/rag/pipeline.ts` — the trace persisted on `messages.retrieval_trace` is:

```
{
  hyde: string,
  candidates: { kb: [{id, preview}], patterns: [...], blogs: [...] },
  fused_top12: [{id, score, source: 'kb'|'pattern'|'blog', preview}],
  rerank_scores: [{id, score}],
  final_context_ids: string[]
}
```

For the modal candidate list, we use `fused_top12` filtered to `source === 'kb'` (those are the KB rows that actually competed to feed the answer), joined to `dalgo_knowledge_base` by id to fetch the first question variant and a snippet of `canonical_answer`. Limit ~5. `final_context_ids` would also work but is too narrow — admins often want to fix a row that *almost* made it.

### Admin UI

**Sidebar nav** (`app/admin/layout.tsx`): inserts `Prompts` between `Knowledge Base` and `Blogs`. No badge.

**`/admin/prompts` (list)** — `app/admin/prompts/page.tsx`:

- 5 cards in fixed order: intro → tools → consultant → boundary → fit
- Each card: humanized section title, last-edited timestamp + editor email, ~120-char content preview, "Edit" link

**`/admin/prompts/[key]` (detail)** — split layout:

- **Left ~70%**: monospace autosizing textarea, full content. Save (disabled until dirty) + Cancel.
- **Right ~30%**: "Version history" panel. Reverse-chron list of `{updated_at, updated_by}`. Click a row → diff modal (red/green line diff against the *currently saved* content). No restore button — admin copies from the diff modal.
- Save: optimistic update + toast `"Saved. Takes effect within 60 seconds."`

**Conversation detail page** (`app/admin/conversations/[id]/page.tsx`) — add a third inline button on each assistant message, next to the existing two:

```
↗ Promote to KB    👁 View retrieval debug    ⚠ This answer is wrong
```

**`<WrongAnswerModal>`** — single modal, three stages, no full page navigation:

1. **Reason.** Textarea ("What was wrong about this answer?") + Submit.
2. **Pick candidate.** After POST returns candidates, render top KB candidates as a clickable list: question (first variant) · score · 1-line canonical_answer snippet. Plus a "None of these — skip fix" option that just closes (report still persisted).
3. **Edit KB row inline.** Pre-filled `<KbEditForm>` for the selected entry. Save → `PUT /api/admin/kb/[id]` (re-embeds) → `PATCH /api/admin/wrong-answers/[id]` with `fixed_kb_id` → close + toast `"KB updated and re-embedded."`

**`<KbEditor>`** — already exists at `components/admin/kb-editor.tsx`. It already handles multiline `question_variants`, multiline `evidence`, status/category dropdowns, and the PATCH route already re-embeds on `question_variants` / `canonical_answer` changes. The "KB editor polish" item from `HANDOFF.md` is therefore already done.

To reuse it inside `<WrongAnswerModal>` we add a single optional `onSaved?: (item) => void` prop: when present, the editor calls it instead of `router.push('/admin/kb')`. No extraction needed.

**Visual aesthetic.** Stick with the existing plain Tailwind look (slate sidebar, white panels). No new design system.

## Data flow

**Editing a prompt:**

```
Admin types in textarea
  → Save click
  → PUT /api/admin/prompts/[key] {content}
      → BEGIN; UPDATE dalgo_prompts; INSERT dalgo_prompt_versions; COMMIT;
      → invalidatePromptCache(key)
      → return updated row
  → toast "Saved. Takes effect within 60 seconds."

Next chat request anywhere:
  → POST /api/chat
  → staticSystem()
      → getPrompt(...) × 5 in parallel
        → cache miss for the edited key → SELECT → cache → return
      → assembled prompt
  → Anthropic API call (cache misses once, re-warms)
```

**Reporting a wrong answer:**

```
Admin clicks "⚠ This answer is wrong" on assistant message
  → modal Stage 1: textarea + Submit
  → POST /api/admin/wrong-answers {message_id, reason}
      → SELECT retrieval_trace FROM messages WHERE id = ...
      → INSERT wrong_answer_reports (..., retrieval_trace_snap)
      → parse top candidates from trace
      → return {id, candidates: [...]}
  → modal Stage 2: candidate list
      → admin picks one OR clicks "skip fix" (modal closes, report stands)
  → modal Stage 3: <KbEditForm> pre-filled with chosen row
      → admin edits, clicks Save
      → PUT /api/admin/kb/[id] {...} (re-embeds)
      → PATCH /api/admin/wrong-answers/[id] {fixed_kb_id}
      → toast + close
```

## Error handling

- **Prompt key missing in DB** (`getPrompt` returns no row): throw. The chat request fails loud rather than serving a partially-assembled prompt. Caught by Next.js error boundary → 500. This is a deploy/migration bug, not a runtime condition.
- **Concurrent prompt save** (two admins edit the same section): last-write-wins on `dalgo_prompts`; both writes appear in `dalgo_prompt_versions`. Acceptable for a 1-2 person editorial team. No optimistic-concurrency UX.
- **`messages.retrieval_trace` missing** (older messages from before Phase 3): the wrong-answer endpoint returns `candidates: []`. Modal Stage 2 shows "No retrieval trace available for this message" and offers only "Submit reason without fix" — report still persisted.
- **Re-embed failure** during KB save: PUT returns 500, modal stays on Stage 3 with the form state intact, toast shows the error. The wrong-answer row is NOT patched with `fixed_kb_id` so it can be retried.
- **Embedding API down / missing OPENAI_API_KEY**: same as above — surface the error to the admin, don't silently save unembedded content.

## Testing

**Unit / integration (Vitest):**

- `tests/lib/prompts.test.ts` — cache hit returns within TTL, expires after 60s, `invalidatePromptCache(key)` busts one entry, `invalidatePromptCache()` clears all, missing key throws.
- `tests/api/admin/prompts.test.ts` — PUT writes both tables atomically (assert rollback if version insert fails), GET versions returns desc order, response shape matches.
- `tests/api/admin/wrong-answers.test.ts` — POST snapshots the trace into `retrieval_trace_snap` (assert the snapshot doesn't change if the message is later edited), PATCH sets `fixed_kb_id`, candidates parsing handles missing-trace gracefully.
- No React component unit test for `<WrongAnswerModal>` — the project's Vitest config is `environment: 'node'` and `@testing-library/react` is not installed. The modal's logic is mostly API-driven (API tests cover that); the React state-machine for stage transitions is verified in the manual smoke test below. Adding jsdom + RTL + jest-dom just for this one component isn't worth the dependency surface.

**Eval:**

- After the refactor, re-run the 50-case suite (`npm run eval`) ONCE and confirm score is unchanged at 45/50. The eval runner's switch to `await staticSystem()` is plumbing, not behavior — but assumption-free verification matters more than the ~$0.50 cost.

**Manual smoke test** (covers the editorial loop end-to-end):

1. Open `/admin/prompts/dalgo_vs_3rd_party`, change one sentence, save.
2. New chat session → ask a question that hits that section's behavior → confirm reply reflects the new sentence within ~60s.
3. Open the resulting conversation in `/admin/conversations/[id]` → click "This answer is wrong" → walk through all three stages → confirm the KB row is updated and re-embedded.
4. Re-open the same prompt section → confirm version history shows two entries (initial seed + the edit) and the diff modal renders.

## Files touched

```
NEW   lib/db/schema.sql                       (append 3 tables, refresh drift section)
NEW   scripts/migrations/001_prompts.sql      (one-shot migration for live container)
NEW   lib/llm/prompts.ts
EDIT  lib/llm/system-prompt.ts                (async assembly via getPrompt)
EDIT  app/api/chat/route.ts                   (await staticSystem)
EDIT  lib/llm/eval/runner.ts                  (await in 2 places)
                                              (lib/embeddings.ts already exports embed() — no change needed)

NEW   app/api/admin/prompts/route.ts
NEW   app/api/admin/prompts/[key]/route.ts
NEW   app/api/admin/prompts/[key]/versions/route.ts
NEW   app/api/admin/wrong-answers/route.ts
NEW   app/api/admin/wrong-answers/[id]/route.ts
EDIT  app/api/admin/kb/[id]/route.ts          (re-embed on save)

NEW   app/admin/prompts/page.tsx
NEW   app/admin/prompts/[key]/page.tsx
EDIT  app/admin/layout.tsx                    (add Prompts nav link)
EDIT  app/admin/conversations/[id]/page.tsx   (third button + modal mount)

EDIT  components/admin/kb-editor.tsx          (add optional onSaved prop for modal use)
NEW   components/admin/wrong-answer-modal.tsx
NEW   components/admin/diff-viewer.tsx        (line diff; tiny diff lib OK)

NEW   tests/lib/prompts.test.ts
NEW   tests/api/admin/prompts.test.ts
NEW   tests/api/admin/wrong-answers.test.ts
```

## Build sequence

1. Schema + `scripts/migrations/001_prompts.sql` + seed (verify the live container picks it up)
2. `lib/llm/prompts.ts` + refactor `staticSystem()` to async + fix eval runner; run `npm test` and a single eval case to confirm plumbing
3. Admin API routes (prompts CRUD + wrong-answers)
4. Add `onSaved` callback prop to existing `components/admin/kb-editor.tsx`; verify `/admin/kb/[id]` still works
5. `/admin/prompts` list + detail pages with diff modal
6. `<WrongAnswerModal>` + button on conversation detail page
7. Sidebar nav update
8. Re-run full eval (~20 min, ~$0.50), confirm 45/50 unchanged
9. Manual smoke test (the 4-step flow above)

## Acceptance criteria

- An admin can change any of the 5 prompt sections at `/admin/prompts/[key]`, save, and have the next chat request (within 60s) reflect the change without a redeploy.
- Every prompt save creates a row in `dalgo_prompt_versions`, viewable as a chronological list with line diff against the current saved content.
- An admin can click "This answer is wrong" on any assistant message, write a reason, see the KB candidates from that message's retrieval trace, pick one, fix it inline, and have the corrected row re-embedded — all without leaving the modal.
- Every wrong-answer report persists in `wrong_answer_reports` with the trace snapshot, even if the admin skips the fix.
- The 50-case eval suite returns the same 45/50 score after the refactor.
