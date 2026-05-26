@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Dalgo Discovery Bot is a conversational AI assistant that helps NGO leaders evaluate whether Dalgo (Tech4Dev's data platform) fits their needs. Every factual claim about Dalgo is grounded in a vector-searchable knowledge base.

## Working mode
- **Autonomous execution.** Do not ask permission for shell commands, file writes, npm/docker/git operations, or before moving between plan tasks. Run things, then report.
- **Do not run destructive commands outside this project.** Anything inside `dalgo-discovery-bot/` is fair game (including `docker compose down -v` to reset the local DB). Outside this directory, ask first.
- If something requires an API key the user hasn't provided (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `TAVILY_API_KEY`, Google OAuth, Resend, Slack webhook), write the code anyway, skip the live-verification step, and continue. Note the missing key in the task report.

## Plan & spec
- Design spec: `Dalgo/docs/superpowers/specs/2026-05-21-dalgo-discovery-bot-design.md`
- Implementation plan: `Dalgo/docs/superpowers/plans/2026-05-21-dalgo-discovery-bot.md`
- Knowledge base: ~164 seed entries across 14 category files (the "131" figure in the spec Appendix A and README is stale — see latest commits).

## Commands
```bash
npm run dev                # Next.js dev server (Turbopack) → http://localhost:3000
npm run build / npm start  # production
npm run lint               # ESLint

npm test                   # Vitest unit + integration (loads .env.local via DOTENV_CONFIG_PATH)
npm test -- tests/lib/pii-redact.test.ts   # single test file
npm run test:e2e           # Playwright happy path (auto-starts dev server)
npm run eval               # LLM eval suite, tests/llm/eval.test.ts (needs ANTHROPIC_API_KEY + OPENAI_API_KEY)

npm run seed:kb            # embed + upsert KB rows incrementally (needs OPENAI_API_KEY)
npm run seed:kb:reset      # TRUNCATE then re-seed all entries
npm run admin:hash         # bcrypt-hash a password for the Credentials admin login
```

## Database
- Local **Postgres 16 + pgvector** via `docker-compose.yml` (host port **5436**, not Supabase cloud).
- Connection string in `.env.local`: `DATABASE_URL=postgres://dalgo:dalgo_dev@localhost:5436/dalgo_discovery`
- Start DB: `docker compose up -d`
- Apply schema: `docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery < lib/db/schema.sql`
- Reset (destructive but project-local — OK): `docker compose down -v && docker compose up -d`

## Architecture

**Chat request flow** (`app/api/chat/route.ts`):
1. `POST /api/chat` rate-limits by IP (Postgres `rate_limit_buckets`), loads the session + message history, persists the user message.
2. Calls Vercel AI SDK v4 `streamText` with Anthropic `claude-sonnet-4-6` (`lib/llm/client.ts`), the agentic toolset, and `maxSteps: 6`, then returns `toDataStreamResponse()`. `onFinish` persists the assistant message and emits telemetry.
3. `GET /api/chat?session_id=` returns the personalized greeting + starter chips, produced once per session by `getOrCreateIntro` and cached on the session row.

**Two-part system prompt** (`lib/llm/system-prompt.ts`): `staticSystem()` (sent with Anthropic `cacheControl: ephemeral` for prompt caching) + a dynamic `ngoContextBlock()` injected per session. The static prompt encodes the core rules — always call `search_dalgo_kb` before any factual claim, be honest about `no`/`partial`/`roadmap` statuses, soft-CTA cadence, and "Fit Assessment Mode".

**Agentic toolset** (`lib/llm/tools/`, assembled by `buildToolset(sessionId)`):
- `search_dalgo_kb` — the grounding mechanism (RAG). Logs low-confidence queries to `unanswered_questions` and emits `kb_hit`/`kb_miss` telemetry.
- `fetch_ngo_website` — Tavily crawl of the NGO's site (`lib/tavily.ts`).
- `parse_pdf` — extract text from an uploaded NGO PDF.
- `request_demo` — capture a lead.
- `suggest_replies` — `execute()` is a no-op; the structured args **are** the payload. The UI watches for this tool call and renders 2–4 clickable chips under the latest message (also used as multiple-choice answers in Fit Assessment Mode).

**KB / RAG pipeline:**
- Source of truth is `lib/db/seed-data/*.ts` — one typed `KbSeed[]` file per category. Edit these, not the DB, to change KB content.
- `npm run seed:kb` embeds each entry (`question_variants | canonical_answer`) with OpenAI `text-embedding-3-small` @ **1536 dims** (`lib/embeddings.ts`) and upserts into `dalgo_knowledge_base`.
- Retrieval (`lib/db/queries/kb.ts`): `searchKb()` embeds the query, calls the `kb_match` Postgres function (pgvector cosine `<=>`), and returns rows with `score = 1 - distance`. Scores below **0.3** count as a miss.

**Data layer:** raw `pg` Pool (`lib/db/client.ts`) — **no ORM**. All queries live in `lib/db/queries/*.ts`. Core tables (`lib/db/schema.sql`): `sessions` (NGO context per visitor), `messages` (`content` is jsonb `{ text }`), `leads`, `feedback`, `telemetry_events`, `unanswered_questions`, `rate_limit_buckets`.

**Admin** (`app/admin/*`, `app/api/admin/*`): protected by NextAuth v5 (`lib/auth.ts`), which registers a username/password Credentials provider (hash via `npm run admin:hash`) and, when configured, Google SSO gated by `ADMIN_ALLOWED_EMAIL_DOMAINS`. Provides KB CRUD at `/admin/kb`, a conversations browser, and a leads table.

**Cron:** `vercel.json` schedules `GET /api/cron/kb-audit` weekly (Mon 09:00), guarded by `CRON_SECRET`; it emails a KB-audit digest via Resend.

## Schema drift to watch
`lib/db/seed-data` defines a `case_studies` category and the code reads `sessions.intro_text` / `sessions.intro_starters`, but `schema.sql`'s category CHECK constraint and `sessions` table do **not** include them — the live DB was ALTERed manually. Resetting the DB from `schema.sql` alone will break case-study seeding and intro caching. Update `schema.sql` if you touch these.

## Stack notes
- **Next.js 16** App Router + React 19 + TypeScript. See `AGENTS.md` — this is not the Next.js in your training data; read `node_modules/next/dist/docs/` before writing framework code.
- **Tailwind v4** — PostCSS-only config, no `tailwind.config.ts`.
- `next.config.ts` pins the Turbopack `root` to this project so it doesn't scan the whole `Dalgo/` workspace (which caused 30s+ compiles).
- **`@supabase/*` packages remain in package.json but are unused** (DB access is via `pg`) — slated for cleanup.
- Path alias `@/*` maps to the project root.

## Project journal

`docs/JOURNAL.md` is the timeline of meaningful changes to this project —
what was added, what was removed, why, and how evals moved.

Before starting work: read the last 3 entries to understand recent context.

After shipping a change: append a dated entry. Don't paraphrase — use the
template (Added / Removed / Why / Eval delta / Carried forward).
