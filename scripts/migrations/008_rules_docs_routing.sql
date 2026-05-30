-- 008_rules_docs_routing.sql
-- Teach the rules prompt about search_dalgo_docs (added in this branch).
--
-- Apply with:
--   docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery \
--     < scripts/migrations/008_rules_docs_routing.sql

BEGIN;

UPDATE dalgo_prompts
   SET content = REPLACE(
                   content,
                   '9. **Two new tools are available:**
   - call `search_dalgo_blogs` when the user mentions a specific tool (Kobo, DHIS2, ODK, Power BI), a sector (maternal health, education), or asks how other NGOs have approached something. Cite returned article URLs.
   - call `match_problem_pattern` when the user describes a *problem* in their own words ("we have no system", "data is everywhere") rather than asking a specific feature question. Use the returned consultant_framing and dalgo_response as the spine of your reply.',
                   '9. **Tool routing — pick the right retrieval source per question type:**
   - call `search_dalgo_kb` for *what does Dalgo do / pricing / fit* questions (curated capability Q&A).
   - call `search_dalgo_docs` for *how-to / configuration / mechanics* questions — how to set up X, where a setting lives, step-by-step. Cite the doc page URL so the user can read more.
   - call `search_dalgo_blogs` when the user mentions a specific tool (Kobo, DHIS2, ODK, Power BI), a sector (maternal health, education), or asks how other NGOs have approached something. Cite returned article URLs.
   - call `match_problem_pattern` when the user describes a *problem* in their own words ("we have no system", "data is everywhere") rather than asking a specific feature question. Use the returned consultant_framing and dalgo_response as the spine of your reply.
   - When in doubt, call several in parallel; the most relevant hit wins.'
                 ),
       updated_by = 'migration:008',
       updated_at = now()
 WHERE key = 'rules';

INSERT INTO dalgo_prompt_versions (prompt_key, content, updated_by, updated_at)
SELECT key, content, updated_by, updated_at
  FROM dalgo_prompts
 WHERE key = 'rules';

COMMIT;
