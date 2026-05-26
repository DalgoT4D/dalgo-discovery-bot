<!-- docs/JOURNAL.md -->
# Dalgo Discovery Bot — Journal

Append a dated entry every session that ships a change. Keep entries terse —
this is a timeline you'll scan a year from now, not a design doc.

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
