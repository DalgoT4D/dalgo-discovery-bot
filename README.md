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
cp .env.example .env.local
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
- `npm run seed:kb` — incrementally embed + insert KB rows
- `npm run seed:kb:reset` — truncate + re-seed all 131 entries
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

- 131 entries across 13 categories (data_sources, transforms, dashboards, …)
- Vector search via pgvector + OpenAI embeddings
- Admin UI at `/admin/kb` (Google SSO required)

## License

AGPL v3 — matches Dalgo's main project license. See `LICENSE`.
