// scripts/seed-patterns.ts
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';
import { embedBatch } from '@/lib/embeddings';
import { problemPatterns } from '@/lib/db/seed-data/problem-patterns';

function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

async function main() {
  console.log(`[seed-patterns] seeding ${problemPatterns.length} patterns...`);

  if (process.env.SEED_RESET === 'true') {
    console.log('[seed-patterns] SEED_RESET=true — truncating dalgo_problem_patterns');
    await query('TRUNCATE dalgo_problem_patterns');
  }

  const embedTexts = problemPatterns.map(
    (p) =>
      `${p.archetype}\n${p.problem_phrasing.join(' | ')}\n${p.consultant_framing}`,
  );
  const vectors = await embedBatch(embedTexts);

  for (let i = 0; i < problemPatterns.length; i++) {
    const p = problemPatterns[i];
    const v = vectors[i];
    await query(
      `INSERT INTO dalgo_problem_patterns
         (archetype, problem_phrasing, consultant_framing, dalgo_response, evidence_urls, embedding)
       VALUES ($1, $2, $3, $4, $5, $6::vector)
       ON CONFLICT (archetype) DO UPDATE SET
         problem_phrasing   = EXCLUDED.problem_phrasing,
         consultant_framing = EXCLUDED.consultant_framing,
         dalgo_response     = EXCLUDED.dalgo_response,
         evidence_urls      = EXCLUDED.evidence_urls,
         embedding          = EXCLUDED.embedding,
         updated_at         = now()`,
      [p.archetype, p.problem_phrasing, p.consultant_framing, p.dalgo_response, p.evidence_urls, vectorLiteral(v)],
    );
  }

  console.log(`[seed-patterns] done`);
  await pool().end();
}

main().catch(async (e) => {
  console.error('[seed-patterns] fatal:', e);
  await pool().end().catch(() => {});
  process.exit(1);
});
