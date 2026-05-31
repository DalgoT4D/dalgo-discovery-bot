-- 009_plain_language_rule.sql
-- Make plain, non-technical language the explicit default for the bot, and
-- require that any unavoidable technical term be glossed in brackets on first
-- use. The audience is non-technical NGO staff; jargon must never leave them
-- confused. Adds Rule 12 to the `rules` prompt and fixes Rule 11's dangling
-- "See Rule 12 for the boundary discipline" cross-reference (the boundary
-- discipline lives in the dalgo_vs_3rd_party prompt, not a numbered rule).
--
-- Apply with:
--   docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery \
--     < scripts/migrations/009_plain_language_rule.sql

BEGIN;

-- 1. Fix the dangling cross-reference in Rule 11.
UPDATE dalgo_prompts
   SET content = REPLACE(
                   content,
                   'See Rule 12 for the boundary discipline.',
                   'See the Dalgo-vs-3rd-party boundary section.'
                 )
 WHERE key = 'rules';

-- 2. Append Rule 12: plain language by default + bracket-gloss every term.
UPDATE dalgo_prompts
   SET content = content || $rule$

12. **Plain, non-technical language is the DEFAULT — explain every technical term.** The primary audience is non-technical NGO staff (program leads, EDs, M&E officers) who have not heard words like "warehouse", "ETL", "schema", "pipeline", "orchestration", or "dbt". Lead with everyday language. When a technical term is genuinely needed, keep the term but immediately gloss it in brackets the first time it appears — e.g. "a warehouse (one central place where all your data is brought together)", "transformation (cleaning and reshaping raw data so it makes sense)", "a pipeline (the automated flow that moves your data)".
    Use this plain framing as the canonical way to describe what Dalgo does: *Dalgo pulls your data from all your different sources, puts it in one single place (a warehouse), then cleans and combines it (transformation/analysis) so the raw data starts to make sense — and from there you can analyse it, build dashboards, and create reports.*
    Never leave a jargon word unexplained, and never assume the reader is technical. If the user signals they ARE technical or asks for more depth, you may drop the brackets and go deeper; if they ask for it even simpler, simplify further. **This rule is about clarity, not dumbing down — never sacrifice honesty or accuracy to simplify.** It complements Rule 11 (hide engine names by default); Rule 12 goes further: explain ANY technical word, not just internal engine names.$rule$,
       updated_by = 'migration:009',
       updated_at = now()
 WHERE key = 'rules';

-- 3. Snapshot the new version for history.
INSERT INTO dalgo_prompt_versions (prompt_key, content, updated_by, updated_at)
SELECT key, content, updated_by, updated_at
  FROM dalgo_prompts
 WHERE key = 'rules';

COMMIT;
