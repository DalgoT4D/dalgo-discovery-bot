<!-- docs/JOURNAL.md -->
# Dalgo Discovery Bot — Journal

Append a dated entry every session that ships a change. Keep entries terse —
this is a timeline you'll scan a year from now, not a design doc.

---

## 2026-06-04 — KB for the new Metrics & KPIs feature

**Added**
- New KB category **`kpis`** (`lib/db/seed-data/kpis.ts`, 12 entries) for the Metrics & KPIs feature that shipped to `main` in DDP_backend (PR #1397) and webapp_v2 (PR #313). Covers: what a **Metric** is (reusable measure, Simple aggregation or Calculated SQL expression, validated against the warehouse, "Used By" tracking); what a **KPI** is (metric + target + direction + RAG thresholds + time grain); **RAG status** (On Track / Needs Attention / Off Track); **results-chain tagging** (input/output/outcome/impact + program tags — the M&E hook); **annotations / beneficiary quotes**; **KPIs on dashboards & in shared reports**; aggregations (the 6) + calculated expressions; export (PNG/CSV) + RBAC; and honest limitations.
- `seed:kpis` npm script + `scripts/seed-kpis.ts` (targeted upsert, same pattern as `seed-positioning.ts`).
- `kpis` added to `KbCategory`, `schema.sql` (both CHECK blocks + live `ALTER`), `seed-kb.ts`, and the `search_dalgo_kb` tool category enum.

**Honesty anchors (status: no/partial)**
- **No KPI alerting/notifications** (`status:no`) — RAG is display-only, computed live on view; nothing emails on a breach.
- **No custom comparison period** (`status:partial`) — % change is previous-period-only, no "vs same period last year".
- **No dimensional drill-down / metric filters** (`status:partial`) — metrics are a single number, KPIs break down by one time dimension only; "by region/gender" lives in **charts**. Verified by parallel backend + frontend code-reads (agents); both agreed there is no alert code and no Celery/scheduled recompute.

**Why**
- These are genuinely **native** Dalgo features (not Superset), so the bot can answer with confident "in Dalgo you can…" — and KPIs map cleanly onto NGO results-chains and funder targets, reinforcing the decisions-first primary benefit. The bot had nothing on them.

**Eval delta**
- Retrieval probes (k=3): "track KPIs and targets" 0.81; "on track against goals" rank 1; outcome/impact 0.62; "alert me when off track" → **`status:no` @ 0.80** (honesty works); dashboard tiles 0.78; aggregations 0.71; drill-down/comparison hit the `partial` entries. Lint clean; KB + search-tool tests 8/8.
- **Soft spot:** "define a reusable metric" competes with a pre-existing `dashboards` entry "Can I rename metrics (alias)?" — a naming collision (old inline-chart "metrics" alias vs the new saved Metric entity). Still returns metric content; `kpis` category-filter resolves it. Consider disambiguating that old entry later.

**Carried forward**
- **Repos switched to `main`:** to study the feature I checked out `main` (from `prod/metrics_kpis_alerts` in DDP_backend and `worktree-posthog-analytics` in webapp_v2) and pulled. Switch back if you were mid-work on those branches.
- **Prod deploy (discovery bot):** apply the category-CHECK `ALTER` for `kpis`, then run `npm run seed:kpis` against prod (targeted upsert, no reset).
- Evidence in these entries is code paths (no public blog/docs URL exists for the feature yet) — swap in a dalgo_docs/blog URL once published.

---

## 2026-06-04 — Positioning layer: RTBs, competitive entries, decisions-first voice + KB dedup

**Added**
- New KB category **`positioning`** (`lib/db/seed-data/positioning.ts`, 9 entries) encoding the June 2026 Dalgo Positioning doc: category statement ("data insights platform built exclusively for nonprofits", data-rich/insight-poor), the 6 Reasons to Believe, decisions-first results entry, the two-step (Automate → Illuminate) narrative, and **competitive comparison entries** for Power BI/Tableau/Looker, custom MIS (Dhwani), Zoho (EdZola), DIY Sheets, and do-nothing — each grounded in verified blog/case-study URLs, each using acknowledge-then-reframe (no "bad choice" dismissals), house style (no "X, not Y" contrast phrasing).
- New system-prompt key **`positioning`** (migration `010_positioning_prompt.sql`), wired into `staticSystem()` after identity: teaches the bot *what to convey* (category, primary benefit = decisions, RTBs, two-step) and *how to handle competitors*, plus house anti-patterns. Complements `rules` (still must ground via `search_dalgo_kb`).
- Augmented existing KB: `pricing` (no per-user/per-row, flat-as-you-grow — RTB #4), `security` (Digital Public Good recognition + DPDP-readiness-in-progress — RTB #3), `mission` (ecosystem backers: Agency Fund/Goalkeep/Dasra — RTB #6), `data_sources` (connector count 400+ → **600+** + "Dalgo builds new connectors free").
- `seed:positioning` npm script + `scripts/seed-positioning.ts` — targeted UPSERT (delete-by-exact-question_variants then insert) so it never duplicates and never touches admin-curated rows. Re-embeds the changed data_sources entry.
- `positioning` added to `KbCategory` (`types.ts`), `schema.sql` (both CHECK blocks + live `ALTER`), `seed-kb.ts`, and the `search_dalgo_kb` tool's category enum (so the bot can scope to it).

**Changed / Fixed**
- **Deduped the live KB: 352 → 188 rows** (total now == distinct). `seed:kb` does a plain INSERT (not the upsert the CLAUDE.md claims), so it had been run ~2× without reset, leaving ~164 exact duplicates that were consuming `top_k` slots and burying correct answers. FK-safe dedup kept, per duplicate group, the row referenced by `wrong_answer_reports.fixed_kb_id` (else earliest) — wrong-answer fix links held at 5 before/after, no admin content lost.
- Updated prompt-count assertions 6 → 7 (`prompts-schema.test.ts`, `prompts.test.ts` admin route count, `system-prompt.test.ts` now asserts the positioning block).

**Why**
- The bot was factually solid but positionally thin: it led with time-savings everywhere, had no competitive answers, and missed every RTB (DPG, ecosystem, no-per-seat pricing). The doc's core reversal — **lead with better decision-making, demote time saved** — needed to live in both the voice (system prompt) and the grounding (KB).

**Eval delta**
- Retrieval probes before/after dedup: "Does Dalgo charge per user?" went from *absent in top 8* → **rank 1 @ 0.72**; "Why is Dalgo better than Power BI for nonprofits?" → **0.84**; custom-MIS entry rank 1 @ 0.74 (category-scoped) / 0.64 (natural phrasing). Prompt suites 22/22 green. Full `npm run eval` not re-run this session.
- **Known follow-up:** the verbatim "how is Dalgo different from a custom MIS?" *unfiltered* still favors case studies — an `ivfflat` (lists=50, 1 probe) approximate-recall artifact, not a content gap. Covered via natural phrasings + category filter + system prompt. Consider bumping `ivfflat.probes` in `searchKb`.

**Carried forward**
- **Prod deploy:** (1) apply the category-CHECK `ALTER` + `scripts/migrations/010_positioning_prompt.sql`; (2) run `npm run seed:positioning` against prod (no reset — it's a targeted upsert); (3) run the FK-safe dedup if prod has the same duplicate bloat. Prompt cache picks up the new key within ~60s.
- **Real bug to fix separately:** `seed:kb` is not idempotent (no unique constraint / ON CONFLICT) despite the CLAUDE.md description — every non-reset run re-duplicates the whole KB. Add a unique key or switch to upsert.

---

## 2026-05-31 — Chat greeting + plain-language jargon rule

**Added**
- First-visit greeting now renders as the bot's **opening message**: introduces the "Dalgo Fit Bot", a one-line description of Dalgo, and a note that answers default to plain, non-technical language (more/less depth on request). The `greeting` string from `GET /api/chat` was computed but **never displayed** — wired it through `app/chat/[sessionId]/page.tsx` → `ChatStream` and rendered in the intro state above the starter cards (`MessageBubble` + `Markdown`).
- Rule 12 in the `rules` system prompt (migration `009_plain_language_rule.sql`): plain language is the default; any unavoidable technical term gets glossed in brackets on first use, e.g. "a warehouse (one central place where all your data is brought together)". Includes the canonical plain framing of Dalgo's flow (pull → one place/warehouse → transform → analyse/visualise/report).

**Changed**
- Greeting copy rewritten (`app/api/chat/route.ts`); trailing line now points at the suggestion cards below instead of nonexistent "categories on the left".
- Fixed Rule 11's dangling "See Rule 12 for the boundary discipline" → "See the Dalgo-vs-3rd-party boundary section".

**Why**
- The greeting was dead data (returned by the API, ignored by the UI), so new visitors saw a generic "How can Dalgo help…" heading. Separately, the bot leaked jargon (warehouse, dbt, orchestration) at non-technical NGO readers.

**Eval delta**
- Not re-run. Verified in-browser: greeting renders as the opening message; the "What is Dalgo?" answer glossed "warehouse" and "transformation" inline in brackets.

**Carried forward**
- **Prod deploy:** apply `scripts/migrations/009_plain_language_rule.sql` to the prod DB (prompt cache picks it up within ~60s). Code is in commit `ed0b2de`; this entry is docs-only.

---

## 2026-05-31 — Eval run: resume live status on load + Cancel button

**Added**
- Cancel a running eval: `cancelEvalRun()` (`UPDATE … SET status='cancelled' WHERE status IN ('pending','running')`, returns whether it actually cancelled), `POST /api/admin/eval-runs/[id]/cancel`, and a Cancel button in `RunEvalsButton` shown while a run is in flight. `cancelled` added to the `dalgo_eval_runs.status` CHECK (migration `2026-05-31-eval-run-cancel.sql`, mirrored in `schema.sql`) + `EvalRunStatus` + `EvalRunProgress` terminal handling.
- `processRunChunk` re-reads run status before each case and **bails if it's no longer `running`** — so cancel actually stops burning LLM calls mid-chunk and a cancelled run is never overwritten with `succeeded`. (claim already ignores terminal runs, so it won't be re-picked up.)
- Tests: `tests/api/admin/eval-run-cancel.test.ts` (cancel query no-op-on-terminal, route, and the drainer bail-mid-run). 14 eval-path tests green.

**Changed**
- `RunEvalsButton` now reattaches the progress poller **on page load** (`GET /api/admin/eval-runs` → first `pending`/`running` run) so live status resumes after a refresh / revisit / second tab — the run was always advancing in the DB; the UI just wasn't watching it.
- `drain.test.ts` setup marks runs `running` before `processRunChunk` (matches the real contract — it's only called post-claim).

**Why**
- The status panel was confusing: progress is in the DB and the page polls every 2s, but the poller only started after an in-session click, so a refresh showed an idle button mid-run. And there was no way to stop a run once started.

**Eval delta**
- None. **Prod deploy:** run `lib/db/migrations/2026-05-31-eval-run-cancel.sql` once.

---

## 2026-05-31 — Fix: eval runs stalled in local dev (no cron to drive chunks)

**Changed**
- `POST /api/admin/eval-runs` `after()` now loops `drainEvalRuns()` until the queue is empty **when not on Vercel** (`!process.env.VERCEL`); on Vercel it still does one chunk and defers to the per-minute cron.

**Why**
- The 2026-05-30 queue change moved execution to chunks driven by the Vercel cron — but that cron doesn't exist under `npm run dev`, so a local run did one `after()` chunk and then stalled (status stuck `running`, progress bar frozen). This was a regression from the old `setImmediate(executeFullRun)`, which ran the whole suite in-process. Polling was never broken — there was just nothing advancing the run locally. The loop restores in-process completion for local dev while keeping the durable cron path on Vercel.

**Eval delta**
- None. New `tests/api/admin/eval-runs-drain.test.ts` (LLM mocked): local path drains to completion; Vercel path (`VERCEL=1`) does exactly one chunk. 2/2 + related eval tests green.

---

## 2026-05-31 — Lead follow-up opt-in, role capture, and admin triage

**Added**
- `sessions.work_domain` / `wants_followup` / `triage_status` columns (migration `lib/db/migrations/2026-05-31-lead-triage-role-followup.sql`, mirrored in `schema.sql`). Per-person model: one email = one session, so role/opt-in/triage are session attributes; `leads` stays an event log.
- `lib/work-domains.ts` — shared role taxonomy (value→label) copied verbatim from webapp_v2's signup `work_domain` field (`none`, `monitoring_evaluation`, `program_manager`, `data_tech`, `leadership`, `field_worker`) + `workDomainLabel()`.
- `setWantsFollowup()` / `setTriageStatus()` in `lib/db/queries/sessions.ts`.
- `PATCH /api/followup` — guest opt-in; sets `wants_followup=true`, emits `lead_captured` (`source_cta: 'followup_optin'`), non-fatal Slack hot-lead ping using the already-stored email.
- `PATCH /api/admin/leads/[sessionId]` — admin-only triage status update (404 via `rowCount`).
- `components/followup-optin.tsx` — passive, dismissible card ("Want the Dalgo team to reach out to you at <email>?"), uses the stored email (no re-entry), localStorage-gated per session, floats in the right margin on `lg+`.
- Optional role `<select>` at the email gate (`app/(landing)/page.tsx`), guest flow only.
- Tests: 21 new across work-domains, sessions setters, intake role (+resume backfill/no-overwrite), followup, person-centric leads query, triage PATCH.

**Changed**
- `/api/intake` accepts optional `work_domain` (zod enum), persists on insert, backfills on email-resume only when none stored (won't overwrite).
- `GET /api/admin/leads` is now **person-centric**: one row per non-admin session with an email (`is_admin=false`), `LEFT JOIN leads` → `requested_demo = bool_or(intent='demo')`. Returns `session_id, created_at, email, work_domain, ngo_url, wants_followup, requested_demo, triage_status`.
- `components/admin/lead-table.tsx` rewritten: New/Approved/Rejected tabs (client-side filter, per-tab counts), Role/Follow-up?/Demo? columns, per-row Approve/Reject → triage PATCH + SWR `mutate()`. Dropped `useTableFilter` here.
- `lib/db/client.ts` `query()` now also returns `rowCount` (additive, backward-compatible) so the triage route can 404.

**Removed**
- `components/soft-cta-banner.tsx` and `/api/lead` — the in-chat banner redundantly re-asked for an email already captured at intake. The conversational `request_demo` tool is unchanged.

**Why**
- Email is captured at the landing gate, so re-asking in chat was wasteful. Make follow-up a one-click signal, capture role for sales context, and give the leads list an actionable approve/reject workflow with the approved tab as the work queue.

**Eval delta**
- None (no KB/retrieval change). 21/21 new tests pass; no new tsc/eslint errors (4 tsc + 2 eslint issues are pre-existing and unrelated).

**Carried forward / next**
- **Prod deploy step:** run `lib/db/migrations/2026-05-31-lead-triage-role-followup.sql` once against prod.
- Manual visual check still pending: follow-up card placement on desktop/mobile and the gate role dropdown styling.
- Admin triage has no audit trail (current status only), no notify-on-approve, no bulk actions, no error toast on a failed Approve/Reject PATCH — add if they bite.

---

## 2026-05-30 — Durable background jobs on Vercel (eval-run Postgres queue + after())

**Added**
- `lib/db/migrations/2026-05-30-eval-run-queue.sql` — adds `next_offset` + `locked_at` to `dalgo_eval_runs` and a one-time cleanup marking pre-existing `pending`/`running` runs `failed` (see Why). DDL also folded into `schema.sql`.
- `claimNextEvalRun()` in `lib/db/queries/eval-runs.ts` — atomically claims the next due `full` run (`pending`, or `running` with a stale >5min lease) via `FOR UPDATE SKIP LOCKED`; safe under concurrent drainers. Lease = `locked_at`.
- `drainEvalRuns()` + exported `processRunChunk()` in `lib/llm/eval/run-service.ts` — process one **time-bounded chunk** (budget `EVAL_CHUNK_BUDGET_MS`, default 210s under `maxDuration=300`), checkpointing `next_offset` + counters + lease heartbeat after **every case**, so a killed/timed-out chunk resumes exactly where it stopped. Budget is checked AFTER each case so every claimed chunk makes ≥1 case of progress (a too-small/0 budget can never stall the run). On a voluntary budget-yield the lease is **released** (`locked_at=NULL`) so the next tick continues immediately; only a crash leaves the lease set, and the 5-min stale window handles that without a double-run.
- `app/api/cron/eval-drain/route.ts` — per-minute cron (added to `vercel.json`) that drains the queue one chunk per tick; `CRON_SECRET`-guarded like `kb-audit`.
- `vitest.config.ts` → `fileParallelism: false`. These are integration tests against one shared Postgres with global state, so parallel files race (a pre-existing hazard — `eval-runs.test.ts`'s global `enabled`-flag toggling already conflicted with `run-service.test.ts`). Trades full-run speed for correctness.
- Tests: `tests/lib/llm/eval/drain.test.ts` (fast, LLM mocked — happy path, resume-from-offset, already-complete) and `tests/api/cron/eval-drain.test.ts` (real cron route handler — auth 403s + a full multi-tick drain with `EVAL_CHUNK_BUDGET_MS=0` forcing one case/tick: pending→running→succeeded across 3 ticks, lease released between ticks, exactly 3 result rows). Claim/lease lifecycle also verified directly against the DB. NB: these DB-mutating eval tests share `dalgo_eval_runs` and the global claim, so they must run serially (`--no-file-parallelism`) — same constraint as the existing eval tests' global `enabled`-flag toggling.

**Changed**
- `startFullRun()` now only **enqueues** a `pending` run (no more `setImmediate(executeFullRun)`); removed `executeFullRun`. `runSingleCaseNow` refactored onto a shared `runAndPersistCase`.
- `POST /api/admin/eval-runs` → `maxDuration=300` + `after(drainEvalRuns)` so the first chunk starts immediately; the cron continues the rest. Claim locking makes the overlap safe.
- `POST /api/admin/blogs/refresh` → `maxDuration=300` + `after()` instead of a bare `void` promise (which Vercel kills once the response returns). Incremental refresh fits one invocation; full reseed stays the local `npm run seed:kb:reset` CLI.
- `POST /api/admin/eval-cases/[id]/test` → `maxDuration=300` (one case = bot + multi-run judge).
- Updated existing tests to the queue model (`run-service.test.ts` drains explicitly; `eval-runs.test.ts` no-ops `after()`).

**Why**
- Vercel has no long-lived process — a bare `void promise` / `setImmediate` "background" task is killed the instant the function responds, and a full eval suite (~80 cases × multiple LLM calls, 7–20min) exceeds even the 300s Pro function limit. Chose a Postgres-as-queue + cron drainer (Inngest/QStash/Trigger.dev considered) because these are rare admin-only ops, it adds no vendor, and `dalgo_eval_runs` was already a job-state table. The one-time SQL cleanup is required because the new drainer would otherwise claim & re-run every run the old impl left stuck in `pending`/`running`.

**Eval delta**
- None (execution mechanism only; case logic unchanged). New drain tests 3/3; updated run-service tests 2/2 (real LLM); eval-runs route tests 2/2; touched-file tsc + eslint clean; all routes compile.

**Carried forward / next**
- **Prod deploy step:** run `lib/db/migrations/2026-05-30-eval-run-queue.sql` once against prod, set `CRON_SECRET`, and confirm Vercel registers the new per-minute cron (Pro required for sub-daily crons).
- Offset chunking assumes a stable case set mid-run (`ORDER BY bucket, case_key`); adding/removing cases during a run could shift offsets. Acceptable for rare ops; snapshot the case-key list into the run row if it ever matters.
- No max-attempt cap on a poison run — a chunk that always throws will retry each tick (surfaced via stale `locked_at` + `error`). Add a cap if it bites.

---

## 2026-05-30 — Incremental blog refresh + admin table filters

**Added**
- `getExistingBlogUrls()` in `lib/db/queries/blogs.ts` — one query returning the set of already-ingested blog URLs.
- `components/admin/table-filter.tsx` — reusable `useTableFilter(items, config)` hook returning `{ rows, bar }`. Client-side only (tables are fully loaded, no server pagination yet). Smart search: empty → all; `/pattern/flags/` → regex (case-insensitive by default); otherwise whitespace-separated terms, ALL must substring-match in any order. Plus facet dropdowns (options derived from data) and an inclusive date range. Exported `buildMatcher` covered by `tests/components/admin/table-filter.test.ts` (8 cases).
- Wired filters into KB (`kb-table.tsx`: category + status facets, last-verified range), Leads (`lead-table.tsx`: intent facet, created range), Blogs (`app/admin/blogs/page.tsx`: category facet, published range), Unanswered (`app/admin/unanswered/page.tsx`: created range).

**Changed**
- `runIngest` (`lib/blogs/ingest.ts`) now loads existing URLs up front and skips any already-synced post *before* fetch/LLM-context/embed (previously the skip happened last, inside `upsertArticle`, after paying for embeddings).
- `listPostUrls(category, knownUrls?)` (`lib/blogs/indexer.ts`) stops paginating once a listing page contributes no new-to-DB post — listings are newest-first, so older pages are all synced.

**Why**
- A refresh with no new blogs was re-fetching, re-contextualizing (LLM), and re-embedding (OpenAI) every article every run. User confirmed blogs are never edited after publishing, so URL-existence is a sufficient sync signal — date/edit detection deliberately dropped for speed.
- Admin tables had no search; finding a lead by email or a blog by title meant eyeballing. Frontend filters were the ask ("no pagination, just make it findable").

**Eval delta**
- None (no prompt/retrieval changes). Touched-file tsc + eslint clean; filter matcher tests 8/8; admin routes compile (307 → auth redirect).

**Carried forward / next**
- Edit-detection for blogs intentionally removed. If Tech4Dev ever edits published posts, re-add a cheap content-hash check *before* the LLM/embed step (behind a `--full` flag).
- Filters are client-side; revisit if any admin table grows past a few hundred rows and needs server-side search + pagination.

---

## 2026-05-30 — Guided eval-case editor

**Added**
- `lib/eval-case-templates.ts` — pure data + helpers (bucket templates, judge metadata, case-key suggestion, expected-object cleanup).
- `components/admin/eval-case-form-fields.tsx` — visual form fields for the Expected object, driven by which judges are checked.
- `components/admin/eval-case-help-panel.tsx` — context-aware right-side panel with judge descriptions, real seed examples, and a "Load this example" button.
- Two-column layout on `/admin/evals/new` and `/admin/evals/[id]`. Bucket dropdown now applies a template (judges + expected defaults). Case-key auto-fill on bucket change with inline duplicate warning. JSON textarea preserved behind an "Edit JSON directly" toggle.

**Removed**
- The free-form-JSON-only authoring UX on the eval-case editor. Power-user JSON editing is still available behind the toggle; the default is a guided form.

**Why**
- Non-technical reviewers couldn't author eval cases without reading the seed `.ts` files to figure out which expected fields each judge consumes. The guided form encodes that knowledge in the UI.

**Eval delta**
- None — change is in the authoring UI, not the eval pipeline.

**Carried forward / next**
- `must_retrieve_blog_mentioning` is exposed in the form as "advisory" because the runner doesn't consume it. If we want it enforced, add a check in `lib/llm/eval/judges/retrieval-judge.ts`.
- Guardrails template still uses `[retrieval-judge, llm-judge]` to match seed cases, even though `must_record_unanswered` is only enforced by `exact-match`. Fix at the seed level, not the template.
- Component tests for `eval-case-editor.tsx` deferred — `@testing-library/react` is not installed and per the plan we don't add it unilaterally. Helper-module behavior is covered by `tests/lib/eval-case-templates.test.ts` (20 tests).

**Refs**
- Spec: `docs/superpowers/specs/2026-05-30-guided-eval-case-editor-design.md`
- Plan: `docs/superpowers/plans/2026-05-30-guided-eval-case-editor.md`

---

## 2026-05-29 — Admin sign-in enforcement on chat landing

**Added**
- `POST /api/admin-intake` — server-authoritative endpoint that calls NextAuth `auth()` and returns 401 if the caller is not in the `admins` table. Landing page's "Sign in as admin" now gates on this endpoint's response instead of trusting NextAuth v5-beta's client `signIn` return value.
- Test file `tests/api/admin-intake.test.ts` with 4 integration tests (401, create, resume, normalize) plus `beforeAll`/`afterEach` cleanup so it's idempotent.

**Removed**
- Implicit trust in `signIn('admin-credentials', ...).ok` on the landing page. The cookie-set side effect of `signIn` is still used; the success/failure decision is server-side.

**Why**
- Bug — visitors could type any random email + password in the landing's admin mode and start a chat. Root cause: NextAuth v5-beta's client `signIn` for Credentials with `redirect: false` does not reliably set `ok: false` on bad credentials, AND `/api/intake` had no auth check, so a failed `signIn` did not block the subsequent session-create. Verified fixed end-to-end via Playwright smoke: bogus creds → "Invalid email or password" + 0 DB rows; real admin creds → admin badge + session+lead rows.

**Eval delta**
- None — change is in the auth / session-create path, not the LLM pipeline.

**Carried forward / next**
- `/api/intake` remains open for guest sessions (intentional). No `sessions.is_admin` column — admin test chats still appear in `/admin/conversations` and `/admin/leads` alongside guest chats; follow-up if the noise becomes a problem.
- Branch `feat/blog-ingestion` still not pushed.

**Refs**
- Spec: `docs/superpowers/specs/2026-05-29-admin-signin-enforcement-design.md`
- Plan: `docs/superpowers/plans/2026-05-29-admin-signin-enforcement.md`
- Branch: `feat/blog-ingestion`

---

## 2026-05-26 — Admin-editable prompts + wrong-answer feedback loop

**Added**
- `dalgo_prompts` table (6 sections: `identity`, `tools_inventory`, `rules`, `consultant_mode`, `dalgo_vs_3rd_party`, `fit_assessment`) seeded verbatim from the old hardcoded `staticSystem()`
- `dalgo_prompt_versions` (append-only history; every save inserts a snapshot via a single transaction)
- `wrong_answer_reports` (admin-flagged bad answers with `retrieval_trace_snap` and optional `fixed_kb_id`)
- `lib/llm/prompts.ts` — `getPrompt(key)` with 60s in-memory TTL + per-key `invalidatePromptCache(key?)` that bumps a version counter for debug correlation
- `staticSystem()` rewritten to async; assembles 6 sections in parallel via `Promise.all([getPrompt(...)])` and joins with `\n\n`. Chat route and eval runner switched to `await`
- Admin API: `GET/PUT /api/admin/prompts`, `GET /api/admin/prompts/[key]/versions`, `POST/PATCH /api/admin/wrong-answers`. PUT runs UPDATE + version INSERT in a single Postgres transaction, then `invalidatePromptCache(key)` AFTER COMMIT (never on rollback)
- `/admin/prompts` list + `/admin/prompts/[key]` editor with monospace textarea, version-history sidebar, and line-diff modal (uses the `diff` npm package). Save toast: "Saved. Takes effect within 60 seconds."
- `<WrongAnswerModal>` on conversation detail: 3-stage flow (reason → pick KB candidate from `retrieval_trace.fused_top12` → edit KB row inline via `<KbEditor>` with new `onSaved` prop). PATCHes `fixed_kb_id` on success; "skip fix" path closes but leaves the report row for future review
- Sidebar nav: `Prompts` entry between Knowledge Base and Blogs
- `scripts/migrations/001_prompts.sql` and `002_split_intro.sql` (one-shot, idempotent, dollar-quoted seed; CASCADE-aware DELETE on the obsolete `intro_and_rules` row)
- **Side improvement**: `runAll()` in `lib/llm/eval/runner.ts` now uses a bounded worker pool (default 5, override via `EVAL_CONCURRENCY`). Cuts eval wall-time from ~60 min to ~12 min

**Removed**
- Hardcoded prompt string in `lib/llm/system-prompt.ts` (now DB-backed)
- The 5-section seed shape from migration 001's first draft — split into 6 sections in migration 002 because the original 5 reordered `tools_inventory` AFTER `rules`, producing a different assembled string than the hardcoded original (real eval regression on first re-run). 002 splits `intro_and_rules` → `identity` + `rules` so the join order is byte-identical to the pre-refactor string

**Why**
- Product/consultant team can now fix prompt rules or KB rows from `/admin` without a code change or redeploy. Closes the manual editorial loop that previously required commits — see commit `a9b8ed0` for the kind of fix this enables (Dalgo-vs-3rd-party hard boundary + RLS/Superset hallucination patches)
- Wrong-answer reports persist a snapshot of `retrieval_trace` at report time, so even if the underlying message or KB row changes later, the admin can see exactly which candidates fed the bad reply

**Eval delta**
- Baseline (commit `a9b8ed0`): 45/50 — problem-statement 14/15, tool-names 10/10, citations 10/10, guardrails 4/8, structure 7/7
- After this work: **41/50** — problem-statement 13/15, tool-names 10/10, citations 10/10, guardrails 4/8, structure 4/7. Report at `docs/eval-runs/2026-05-26-18-08.md`
- **Net delta is judge variance, not behavior regression.** Assembled prompt verified byte-identical to the pre-refactor hardcoded string (via runtime `staticSystem().startsWith(originalPrefix)` probe after migration 002). All 9 failures are "LLM-judge 0/3 passes" with zero retrieval-judge or exact-match failures — exactly the variance failure mode HANDOFF.md documents. Specific shifts: `gr-04`/`gr-07` flipped FAIL→PASS, `gr-02`/`gr-05` flipped PASS→FAIL (net 0 in guardrails); new failures `ps-14`, `st-01`, `st-04`, `st-05` are all LLM-judge-only
- Acceptance call: ship. The judge-upgrade (Haiku → Sonnet) is already in the deferred queue; bot behavior is verifiably unchanged

**Carried forward / next**
- Wrong-answer report queue/dashboard UI — table persists data but no read surface in v1
- Per-user permission tiers on prompt editing — all admins can edit
- One-click "Restore version" — admins copy from the diff modal manually
- Guardrails LLM-judge upgrade Haiku → Sonnet — still deferred; the 41/50 vs 45/50 variance reinforces it's worth doing
- Branch `feat/blog-ingestion` not pushed or merged — user-driven decision pending
- **First real use of `/admin/prompts`**: encode "progressive disclosure" rule (don't name Airbyte / Prefect / bare-dbt by default; lead with Dalgo-surface language; reveal internals only on explicit follow-up). Documented in `~/.claude/.../memory/feedback_progressive_disclosure.md`

**Refs**
- Spec: `docs/superpowers/specs/2026-05-26-admin-editable-prompts-design.md`
- Plan: `docs/superpowers/plans/2026-05-26-admin-editable-prompts.md`
- Eval report: `docs/eval-runs/2026-05-26-18-08.md`
- Branch: `feat/blog-ingestion`

---

## 2026-05-26 — Hybrid RAG + dual-KB rollout

**Added**
- `dalgo_blog_articles` + `dalgo_blog_chunks` tables; populated from `projecttech4dev.org/blogs/?category={dalgo,data-catalyst-program}` (107 articles, 583 chunks at first ingest)
- `lib/blogs/` ingestion pipeline (indexer → fetcher → parser → chunker → contextualizer → upsert) with disk-cached HTML, Elementor-aware parser, and sha256 content-hash skip
- `dalgo_problem_patterns` table seeded with 15 curated NGO archetypes (consultant brain layer)
- `lib/llm/rag/` retrieval pipeline: HyDE query rewriter → hybrid vector+lexical retrieval across 3 stores × 3 query rewrites → RRF fusion (curated boost 1.5x) → Claude Haiku rerank → top-5 passages
- New LLM tools: `search_dalgo_blogs`, `match_problem_pattern` (alongside existing `search_dalgo_kb`)
- Consultant-mode system prompt: explicit honesty discipline ("never fake a customer connection") + 3-part reply template (Reframe → Dalgo response → Cite a customer ONLY when retrieval surfaced one)
- Admin pages: `/admin/blogs` (list + detail + Refresh-blogs background job), `/admin/unanswered` (review queue with Dismiss + Answer-and-promote actions)
- Promote-to-KB modal inside `/admin/conversations/[id]` (migrated from query-param to dynamic route)
- Retrieval debug panel showing HyDE rewrites + fused top-12 + rerank scores + final context IDs for any past assistant message
- `messages.retrieval_trace` JSONB; `dalgo_knowledge_base` provenance columns (`source`, `source_message_id`, `author_email`)
- Eval suite extended 30 → 80 cases (5 new buckets); 3 judges (retrieval, llm-3run-majority, exact-match)

**Removed**
- `components/category-sidebar.tsx` and `app/api/categories/route.ts` — the user-chat left rail (user feedback: chat box + suggested chips only)
- Old query-param shape of `/admin/conversations?session_id=…` (now redirects to dynamic route)

**Why**
- NGOs share open-ended problem statements; pure vector search returned generic results
- Needed consultant-style 3-part replies with explicit "I don't have a specific case study" when no clean customer match exists — never fabricate
- Dual-KB lets the team capture great improvised answers from the LLM as canonical entries (provenance tracked)
- Citation discipline (no hallucinated URLs) enforced 100% by the eval suite

**Eval delta**
- Baseline (commit `1f6221b`): 27/50 pass — problem-statement 1/15, guardrails 2/8, structure 0/7
- Post-fix (commit `2da8c60`): **45/50 pass** — problem-statement **14/15**, tool-names **10/10**, citations **10/10**, structure **7/7**, guardrails **4/8** (judge variance — bot is correct on those guardrail cases per manual review)
- Existing legacy 30 cases: no regression (driven by `runLegacyAll` in `lib/llm/eval/runner.ts`)

**Carried forward / next**
- GitHub Actions per-PR eval — deferred
- Patterns admin UI — managed by `lib/db/seed-data/problem-patterns.ts` (re-seed via `npm run seed:patterns`)
- Session continuity / user resume — deferred (see spec §17: cookie + magic-link direction)
- Guardrail LLM-judge upgrade Haiku → Sonnet — deferred (50% pass rate due to judge inconsistency, not bot behavior; raise threshold later when budget allows)
- `docs.dalgo.org` ingestion — same pipeline can absorb it later

**Refs**
- Spec: `Dalgo/docs/superpowers/specs/2026-05-25-rag-upgrade-and-blog-ingestion-design.md`
- Plans: `Dalgo/docs/superpowers/plans/2026-05-25-rag-phase-{1,2,3}-*.md`
- Branch: `feat/blog-ingestion`

---

## 2026-06-02 — Atomic per-IP rate limiting

**Added**
- `lib/rate-limit.ts` rewritten to a single atomic upsert (check-and-increment in one SQL statement) over a fixed window. Returns `retryAfterSec`.
- Defaults: **40 messages / 30-minute window per IP**, tunable via `RATE_LIMIT_MAX_MSG` + `RATE_LIMIT_WINDOW_MINUTES`.
- `POST /api/chat` 429 now sends a plain-language "try again in ~N minutes" message + `Retry-After` header (`route.ts`).

**Removed**
- Old read-then-write rate limiter and the `RATE_LIMIT_MAX_MSG_PER_HOUR` env var (replaced).

**Why**
- The previous limiter read the count and incremented in two separate queries — concurrent requests from one IP could both read a stale count and slip past the cap. A scripted abuser could drain the LLM token budget. The single-statement upsert closes the race.
- Window/limit chosen to be generous for a genuine NGO eval session (~10–30 msgs) while capping a script at ~80/hr per IP.

**Carried forward / next**
- Connection-pool sizing for serverless deploy: `lib/db/client.ts` uses `max: 10` per instance — lower it and/or add a pooler (PgBouncer/Supabase/Neon) before production to avoid `too many connections`. Not a local-dev issue.
- Per-IP only — no protection against a distributed (many-IP) attacker. Add a global daily token/message circuit-breaker if abuse appears.
- Chat is already concurrent (one streaming POST per turn via `useChat` → `toDataStreamResponse()`); no app-logic change was needed for concurrency.

---

## 2026-06-02 — AWS/RDS pooling + abuse protection for public launch

**Added**
- `lib/db/client.ts`: env-driven pool (`DB_POOL_MAX`), `connectionTimeoutMillis` (fail fast under saturation), and RDS SSL (`DATABASE_SSL` / `DATABASE_SSL_STRICT`). Targets a long-running Docker container on AWS + RDS Postgres (total conns ≈ replicas × DB_POOL_MAX).
- `lib/abuse.ts`: per-IP abuse layer on `rate_limit_buckets` (new `strikes` + `blocked_until` columns).
  - `classifyMessage()` — free heuristic pre-filter (empty / symbol-only / exact-repeat → strike; over-`MAX_MESSAGE_CHARS` → reject, no strike). **Unicode-aware** (`\p{L}\p{N}`) so Hindi/non-Latin messages are never mistaken for gibberish.
  - Atomic `recordStrike()` / `getBlockState()` / `clearStrikes()`. Soft-block an IP for `ABUSE_BLOCK_MINUTES` (30) after `ABUSE_STRIKE_THRESHOLD` (5) consecutive low-value turns.
- `flag_unproductive_turn` tool + system-prompt rule (`ABUSE_RULE`, kept in code so it survives a DB reset). The main Sonnet call flags semantic junk/jailbreaks at ~zero extra cost; `onFinish` reads `steps[].toolCalls` → strike (junk) or clear (genuine).
- `app/api/chat/route.ts`: block-check + classify before any LLM call; blocked/junk return 429/422/413 with plain-language guidance + `Retry-After`. Once blocked, **no LLM call happens** — that's what protects the token budget.
- `tests/lib/abuse.test.ts` — 8 tests (heuristics incl. Hindi guard + strike→block→reset lifecycle). All pass.

**Why**
- Going public. Per-IP rate limit (40/30min) does nothing against distributed (many-IP) abuse, and nothing against one IP spamming junk to burn LLM tokens. The strike/block stops sustained junk cheaply; the heuristic + LLM-flag split avoids spending tokens to detect token-wasting.
- Confirmed API keys are server-side only (no `NEXT_PUBLIC_` secrets) — key *exposure* is not a risk; *misuse* is what these layers address.

**Carried forward / next**
- **Distributed attacks still need infra:** AWS WAF rate-based rules on the ALB/CloudFront (volumetric), optional Cloudflare Turnstile on session create, and an app-level **global daily message/token circuit-breaker** (not yet built) as the real backstop for many-IP abuse.
- Blocked/junk responses currently surface via `useChat` error state — optional frontend polish to render them as a friendly inline assistant message + countdown.

---

## 2026-06-02 — Global daily circuit breaker

**Added**
- `global_usage` table (one row per UTC day: `messages`, `tokens`).
- `lib/global-limit.ts`: `checkGlobalLimit()` (read-only, gates before the LLM call) + `recordGlobalUsage(tokens)` (atomic upsert in `onFinish`, using `usage.totalTokens`). Caps via `GLOBAL_DAILY_MAX_MESSAGES` (3000) / `GLOBAL_DAILY_MAX_TOKENS` (10M); set to 0 to disable a dimension. Auto-resets at UTC midnight.
- `app/api/chat/route.ts`: returns 503 + `Retry-After: 3600` to everyone once a cap is hit.
- `tests/lib/global-limit.test.ts` — 3 tests (atomic accumulation + under-cap ok). Pass.

**Why**
- The backstop for distributed (many-IP) abuse that per-IP rate limiting + strikes can't catch — a hard ceiling on daily token spend regardless of how the load is spread. Tokens (not just message count) is the real cost guard.

**Carried forward / next**
- Still infra-level: AWS WAF rate-based rule on ALB/CloudFront for volumetric floods (sheds load before it reaches the container — cheaper than absorbing it).
- Old `global_usage` rows accumulate (tiny); add a cleanup later if desired.
- Consider surfacing today's usage in the admin dashboard so the team sees how close to the cap they are.

---

## 2026-06-03 — Reverted global circuit breaker

**Removed**
- `lib/global-limit.ts`, `tests/lib/global-limit.test.ts`, the `global_usage` table (schema + live DB), the route gate/increment, and the `GLOBAL_DAILY_*` env vars.

**Why**
- Decision to keep abuse protection simple: per-IP rate limit (40/30min) + per-IP nonsense strike/block only. Distributed-abuse defense, if needed later, will be handled at the infra layer (AWS WAF) rather than in-app.

**Carried forward**
- Per-IP rate limit + strike/block remain (from the two prior entries today). AWS WAF rate-based rule still the recommended infra-level next step before public launch.

---

## 2026-06-03 — rate_limit_buckets cleanup cron

**Added**
- `app/api/cron/rate-limit-cleanup/route.ts` — GET guarded by `Authorization: Bearer ${CRON_SECRET}` (same pattern as kb-audit). Deletes rows whose rate-limit window lapsed >1 day ago AND that aren't actively blocked; returns `{ ok, deleted }`.
- `vercel.json` cron: daily at 04:00 (`0 4 * * *`).

**Why**
- `rate_limit_buckets` grows one row per unique visitor IP indefinitely. Stale rows are safe to drop — the next request re-creates a fresh row. Active blocks are preserved until they expire.

**Carried forward**
- vercel.json crons only fire on Vercel. On the planned AWS deploy, schedule this with EventBridge (or any cron) hitting the endpoint with the `CRON_SECRET` bearer header.

---

## 2026-06-03 — Dockerize + in-process cron (node-cron)

**Added**
- `Dockerfile` — multi-stage (deps → build → runner) producing a Next.js **standalone** image (`output: 'standalone'` + `outputFileTracingRoot` pinned in `next.config.ts`), non-root, port 3000.
- `.dockerignore`.
- `docker-compose.yml` — local full stack: pgvector **+ app**, one `docker compose up --build` serves http://localhost:3000. App's `DATABASE_URL` points at the `postgres` service; `schema.sql` auto-applied on first DB init.
- `docker-compose.prod.yml` — remote/EC2: **app only**, against external **RDS** (`DATABASE_URL` + `DATABASE_SSL=true` via `.env.production`/host env). No DB container.
- `instrumentation.ts` — Next instrumentation hook starts **node-cron** in-process (nodejs runtime only; skip via `DISABLE_CRON=true`). Runs rate-limit cleanup daily 04:00 UTC. `lib/maintenance.ts` (`cleanupRateLimitBuckets`) shared by the cron + the HTTP route.
- Dependency: `node-cron@4`.

**Changed**
- `rate-limit-cleanup` removed from `vercel.json` (now in-process); `deploy/crontab.example` notes it's automatic.
- Pre-existing type errors fixed to unblock `next build`: `lib/docs/parser.ts` (cheerio `Element` → `domhandler`), `lib/telemetry.ts` (added `doc_search` to `EventName`).

**Why**
- Deploying on EC2 (Docker) + RDS, not Vercel. In-process node-cron means the container is self-contained — no host crontab/EventBridge needed for routine cleanup. `next build` had never been run green (latent type errors); Docker forces a real build, so they're fixed.

**Verified**
- `npm run build` green; `.next/standalone/server.js` + traced `node-cron` + compiled `instrumentation.js` present. Lib unit tests pass.

**Carried forward**
- schema.sql drift (intro_text, case_studies) still applies to fresh DB init — documented in CLAUDE.md.
- AWS WAF rate-based rule still the infra-level next step.

---

## 2026-06-03 — Remove dead PDF-upload path

**Removed**
- `lib/pdf.ts` (pdfjs-dist text extraction), `app/api/upload/route.ts`, `lib/llm/tools/parse-pdf.ts`, `tests/lib/pdf.test.ts`; `parse_pdf` tool deregistered.
- Deps: `pdfjs-dist`, `pdf-parse` (never imported), `@types/pdf-parse`.

**Why**
- No UI ever uploaded a file, so `/api/upload` was unreachable and `parse_pdf` always returned "No PDF was uploaded". `pdfjs-dist` was also the source of the runtime `@napi-rs/canvas` warning in the Docker container. Dropping the dead path removes the warning and shrinks the image.
- Report generation (`@react-pdf/renderer`, `/api/report`, `app/report/[sessionId]`) is a SEPARATE, still-used feature and was left intact — it does not use canvas.

**Verified**
- `npm run build` green; rebuilt Docker image boots with no canvas warning; cron still registers. tools-inventory + system-prompt tests pass.

**Carried forward**
- `sessions.pdf_url` / `pdf_text` columns remain (harmless, now always null). DB prompt text in `dalgo_prompts` may still mention uploading a PDF — trim there if the bot offers it in conversation.

---

## 2026-06-03 — Fix admin auth in Docker (UntrustedHost)

**Changed**
- `lib/auth.ts`: added `trustHost: true` to the NextAuth config.

**Why**
- The container runs `NODE_ENV=production`, under which Auth.js v5 rejects every `/api/auth/*` request with `UntrustedHost` (it only auto-trusts localhost under `next dev`). This broke the admin panel (blank "Server error" page). `trustHost: true` is the standard setting for self-hosted Auth.js behind your own proxy (Docker/EC2). Verified: `/api/auth/session` → 200, providers load, no auth errors.

**Carried forward**
- On EC2, set `NEXTAUTH_URL` (and `NEXTAUTH_SECRET`) to the real domain in the deploy env.

---

## 2026-06-03 — Fix "report wrong answer" 400 on freshly-streamed messages

**Changed**
- `app/api/chat/route.ts`: pre-generate the assistant message id (`randomUUID`) and pass `experimental_generateMessageId` to `streamText`, so the id streamed to the client (`useChat` `m.id`) equals the persisted DB row id. Persist via the new `appendMessage(..., id)` arg.
- `lib/db/queries/messages.ts`: `appendMessage` accepts an optional explicit `id` (COALESCE to `gen_random_uuid()`).

**Why**
- Admin "Report a wrong answer" POSTed `message_id = m.id`, but for messages streamed in the current session `m.id` was useChat's client-generated id (not a UUID), so the route's Zod `uuid()` check returned HTTP 400. (Reloaded history worked because it carried DB UUIDs.) Now both paths use the DB UUID.

**Verified**
- AI SDK source: server writes the id to the data-stream `start_step`; client sets `message.id` from it. DB insert (explicit + fallback) tested. `npm run build` green.

---

## 2026-06-03 — Drop the LLM reranker from the RAG critical path

**Changed**
- `lib/llm/rag/pipeline.ts`: disabled the LLM rerank step (behind `USE_RERANK = false`) and now feed Sonnet the RRF-fused top-7 directly (`NO_RERANK_TOPK = 7`). `rerankCandidates` stays imported for a one-line revert.
- `tests/llm/eval.test.ts`: raised the legacy-suite timeout 300s → 900s (the 30 cases run sequentially and the suite was hitting the 5-min wall).

**Why**
- Investigating an "8-10s per answer" complaint (user suspected HyDE — but HyDE was already bypassed). Added temporary timing logs to `route.ts` + `pipeline.ts` and measured warm: retrieval blocked the first token for ~5.6s, of which **~4.7s was the rerank** — a Haiku call scoring 12 passages. Hybrid retrieval itself was only ~0.9s.
- The reranker (top-12 → top-5) was redundant: RRF fusion already produces a ranked, source-boosted list, and only ~5-7 short passages reach Sonnet, which judges relevance itself.

**Eval delta** (legacy 30-case suite, same run):
- rerank ON: 25/30 (83%)
- rerank OFF, fused top-5: 24/30 (80%) — lost `bigquery`
- **rerank OFF, fused top-7: 26/30 (87%)** — recovered `bigquery` + `personalize-kobo`. So removing the reranker is both faster AND higher quality; the wider slice keeps entries the reranker had trimmed.
- Remaining 4 failures (pivot, opensrc, realtime, customchart) fail in every config — pre-existing KB-content gaps, unrelated.

**Verified**
- Warm latency (local dev): time-to-first-token ~7s → ~3.5s; total ~21-25s → ~13-15s. Timing logs were temporary and have been removed; `route.ts` and `pipeline.ts` are back to clean.

**Carried forward**
- The remaining ~13s is the Sonnet generation loop (`maxSteps: 6`, observed 2-3 steps because the model still calls `search_dalgo_kb` despite pre-fetch). Next lever for latency, but it touches the grounding guarantee — measure before cutting.
- HyDE remains bypassed; `rewriteQuery` and `rerankCandidates` are both dead-but-imported for one-line revert. If neither is restored, delete both + their tests.
- The 4 pre-existing eval misses are KB-content gaps, not retrieval-ranking — fix in `lib/db/seed-data` if pursued.

---

## 2026-06-04 — Wrong-answer review queue + LLM-assisted KB fix

**Added**
- Admin **review queue** for wrong-answer reports — the table was previously write-only with no read surface. `GET /api/admin/wrong-answers` (status filter + message/conversation join) feeds `/admin/wrong-answers` (`components/admin/wrong-answers-table.tsx`) + a nav entry.
- Mark-wrong now captures an optional **suggested answer** (`wrong_answer_reports.suggested_answer`) alongside the reason.
- **LLM draft-fix**: `lib/llm/draft-kb-fix.ts` + `POST .../[id]/draft-fix` — given the wrong answer, reason, suggested answer, and the retrieval-trace candidates, drafts a corrected KB entry and decides **edit-existing vs create-new** (and now picks the KB **category**, validated against the schema enum).
- **Transactional resolve**: `POST .../[id]/resolve` (create | edit | dismiss). On approve it writes the KB (re-embedded + versioned via new transaction-aware helpers `insertKbEntryTx` / `versionAndUpdateKbTx` in `lib/db/queries/kb.ts`, provenance `source='wrong_answer_fix'`), upserts a regression **eval case**, and flips the report to `resolved` — all in one transaction (embedding computed before BEGIN). After commit it re-runs `runPipeline` to confirm the fixed entry ranks top.
- **`answer_must_convey`** criterion on the llm-judge so the auto-created eval case meaningfully asserts the corrected answer; "Run eval now" in the modal triggers that single case via the existing `eval-cases/[id]/test` endpoint.
- New lifecycle columns on `wrong_answer_reports` (`status`, `fix_kind`, `resolved_by/at`) with idempotent upgrade-path ALTERs in `schema.sql`; `wrong_answer_fix` added to the KB `source` CHECK.
- Tests across all of the above (schema, list endpoint, draft-fix incl. parse-failure, kb write helpers, resolve transaction).

**Why**
- Closes the loop with no gaps: flag (chat or admin) → queue → LLM-drafted fix → admin approves → KB updated (re-embedded, so retrieval actually changes) → verified by re-run → regression-tested by an eval case. DB is the source of truth; fixes carry across machines via DB migration, not re-seed.

**Eval delta**
- Not re-run (no KB-content change shipped). Full non-eval suite green: 64 files, 219 passed / 1 skipped. Build clean.

**Carried forward**
- Removing the LLM reranker (separate same-day entry) is the active retrieval path; unrelated to this feature.
- `draftKbFix` falls back to category `limitations` if the model returns an unknown category.

**Refs**
- Spec: `docs/superpowers/specs/2026-06-03-wrong-answer-review-and-kb-fix-design.md`
- Plan: `docs/superpowers/plans/2026-06-03-wrong-answer-review-and-kb-fix.md`
- Branch: `feat/wrong-answer-review`
