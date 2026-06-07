# Dalgo Discovery Bot

A conversational AI assistant that helps NGOs evaluate whether Dalgo — a data platform built for NGOs by Tech4Dev — fits their needs. Grounded in a 131-entry capability knowledge base.

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4
- Vercel AI SDK v4 + Anthropic Claude (Sonnet 4.6)
- Local Postgres 16 + pgvector via Docker Compose
- node-postgres (`pg`) for DB access
- NextAuth v5 (Google SSO) for admin
- Vitest + Playwright

## Quick start

```bash
# 1. Start the database
docker compose up -d

# 2. Apply schema (first time only)
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery < lib/db/schema.sql

# 3. Configure env
cp .env.example .env
# fill in ANTHROPIC_API_KEY, OPENAI_API_KEY (for embeddings), TAVILY_API_KEY,
# NEXTAUTH_SECRET, GOOGLE_CLIENT_ID/SECRET, etc.

# 4. Install + run
npm install
npm run dev
# open http://localhost:3000

# 5. (Optional) Seed the knowledge base
npm run seed:kb:reset   # requires OPENAI_API_KEY
```

## Scripts

- `npm run dev` — Next.js dev server (Turbopack)
- `npm run build` / `npm start` — production
- `npm test` — Vitest unit + integration
- `npm run test:e2e` — Playwright happy path
- `npm run eval` — 30-case LLM eval suite (requires ANTHROPIC_API_KEY + OPENAI_API_KEY)
- `npm run seed:kb` — embed + **upsert** KB rows (idempotent: re-run safe, never duplicates, preserves admin-added rows)
- `npm run seed:kb:reset` — truncate + re-seed all entries (wipes admin-added rows)
- `npm run seed:blogs` — crawl + index projecttech4dev.org blog posts
- `npm run seed:docs` — crawl + index the Dalgo product docs site
- `npm run lint` — ESLint

## Environment variables

See `.env.example`. Required at runtime:

- `DATABASE_URL` — Postgres connection
- `ANTHROPIC_API_KEY` — chat LLM
- `OPENAI_API_KEY` — embeddings (text-embedding-3-small @ 1536 dim)
- `TAVILY_API_KEY` — NGO website crawling
- `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — admin auth
- `ADMIN_ALLOWED_EMAIL_DOMAINS` — comma-separated whitelist

Optional:
- `RESEND_API_KEY` + `ADMIN_DIGEST_RECIPIENTS` — weekly KB audit email
- `SLACK_HOT_LEAD_WEBHOOK_URL` — hot-lead Slack notifications
- `CRON_SECRET` — required by Vercel cron handler

## Architecture

See:
- Spec: `../docs/superpowers/specs/2026-05-21-dalgo-discovery-bot-design.md`
- Implementation plan: `../docs/superpowers/plans/2026-05-21-dalgo-discovery-bot.md`

## Knowledge base

The bot has **three retrieval stores**, each searched by a separate tool:

| Store | Source | Tool | When the LLM uses it |
|---|---|---|---|
| Curated KB (~164 entries, 14 categories incl. `case_studies`) | `lib/db/seed-data/*.ts` — hand-written Q&A | `search_dalgo_kb` | Capability / pricing / fit questions |
| Blogs (~107 articles) | Scrape of `projecttech4dev.org` | `search_dalgo_blogs` | Customer stories, sector / tool mentions |
| Product docs (~60 pages) | Scrape of `dalgot4d.github.io/dalgo_docs` | `search_dalgo_docs` | How-to / config / mechanics |

Admin UI: `/admin/kb`, `/admin/blogs`, `/admin/prompts` (Google SSO required).

### Keeping it fresh

**Mechanical (auto-updating):**
- Blogs: `npm run seed:blogs` — re-crawl + content-hash-based incremental embed. Admin "Refresh" button at `/admin/blogs`.
- Product docs: `npm run seed:docs` — same pattern. Re-run manually after the Dalgo docs site changes (no cron yet — see `app/api/admin/docs/refresh/route.ts` for the admin POST endpoint). Set `DOCS_SITEMAP_URL` in env to override the source URL.

**Manual (curated KB):**
- The curated KB is hand-written; new Dalgo features (e.g. KPI/metrics) need new KB entries.
- Today's flow: edit `lib/db/seed-data/*.ts` → `npm run seed:kb` → review in `/admin/kb`. Or ask Claude to re-scan the upstream Dalgo codebase + docs and draft new entries against the `KbSeed` shape.
- `wrong_answer_reports` (admin flags bad answers) and `unanswered_questions` (low-confidence queries) are the reactive safety nets. Weekly audit email goes out via `/api/cron/kb-audit` (Mon 09:00 UTC) if `RESEND_API_KEY` + `ADMIN_DIGEST_RECIPIENTS` are set.

**Planned (not yet built):**
- LLM-assisted KB drift check — compare each curated row against current docs/blogs, flag contradictions.
- KB-suggestion queue — auto-draft entries when new doc pages appear or when an `unanswered_questions` cluster forms.

## License

AGPL v3 — matches Dalgo's main project license. See `LICENSE`.
