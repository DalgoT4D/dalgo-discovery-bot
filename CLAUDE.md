@AGENTS.md

# Dalgo Discovery Bot — Project Conventions

## Working mode
- **Autonomous execution.** Do not ask permission for shell commands, file writes, npm/docker/git operations, or before moving between plan tasks. Run things, then report.
- **Do not run destructive commands outside this project.** Anything inside `dalgo-discovery-bot/` is fair game (including `docker compose down -v` to reset the local DB). Outside this directory, ask first.
- If something requires an API key the user hasn't provided (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `TAVILY_API_KEY`, Google OAuth, Resend, Slack webhook), write the code anyway, skip the live-verification step, and continue. Note the missing key in the task report.

## Plan & spec
- Design spec: `Dalgo/docs/superpowers/specs/2026-05-21-dalgo-discovery-bot-design.md`
- Implementation plan: `Dalgo/docs/superpowers/plans/2026-05-21-dalgo-discovery-bot.md`
- Knowledge base: 131 seed entries enumerated in spec Appendix A

## Stack notes
- **Next.js 16** (create-next-app@latest installed 16, not 15 — the App Router conventions the plan uses are stable). See `AGENTS.md` for the Next 16 caveat.
- **Tailwind v4** — PostCSS-only config, no `tailwind.config.ts`.
- **Local Postgres + pgvector** via `docker-compose.yml` (port 5436), not Supabase cloud.
- **`pg` (node-postgres)** client, not `@supabase/supabase-js`.
- **`@supabase/*` packages remain in package.json but are unused** — slated for cleanup in a later task.

## Database
- Connection string in `.env.local`: `DATABASE_URL=postgres://dalgo:dalgo_dev@localhost:5436/dalgo_discovery`
- Start DB: `docker compose up -d`
- Apply schema: `docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery < lib/db/schema.sql`
- Reset (destructive but project-local — OK): `docker compose down -v && docker compose up -d`

## Testing
- `npm test` — runs Vitest with `.env.local` loaded via `DOTENV_CONFIG_PATH`
- `npm run test:e2e` — Playwright
- `npm run eval` — 30-case LLM eval suite (requires `ANTHROPIC_API_KEY`)
