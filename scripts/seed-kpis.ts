import 'dotenv/config';
import { pool, query } from '@/lib/db/client';
import { embedBatch } from '@/lib/embeddings';
import { kpis } from '@/lib/db/seed-data/kpis';
import type { KbSeed } from '@/lib/db/seed-data/types';

// Targeted UPSERT for the Metrics & KPIs KB entries (June 2026).
//
// Same approach as scripts/seed-positioning.ts: the live KB holds
// admin-curated rows not in the seed files, so we cannot reset / full-reseed.
// This script touches ONLY the kpis entries — it deletes any rows whose
// question_variants exactly match (idempotent) and inserts one fresh embedded
// row each. New entries simply insert (clear 0).

function pgVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

async function main() {
  const entries: KbSeed[] = kpis;
  console.log(`Upserting ${entries.length} kpis entries...`);
  const texts = entries.map(
    (s) => `${s.question_variants.join(' | ')}\n\n${s.canonical_answer}`,
  );
  const vectors = await embedBatch(texts);

  let inserted = 0;
  let deleted = 0;
  for (let i = 0; i < entries.length; i++) {
    const s = entries[i];
    const v = vectors[i];
    const del = await query(
      `DELETE FROM dalgo_knowledge_base WHERE question_variants = $1::text[]`,
      [s.question_variants],
    );
    deleted += del.rowCount ?? 0;
    await query(
      `INSERT INTO dalgo_knowledge_base
        (category, question_variants, canonical_answer, status, ngo_framing,
         evidence, notes_for_sales, source_audit_date, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)`,
      [
        s.category,
        s.question_variants,
        s.canonical_answer,
        s.status,
        s.ngo_framing ?? null,
        s.evidence ?? [],
        s.notes_for_sales ?? null,
        s.source_audit_date ?? null,
        pgVectorLiteral(v),
      ],
    );
    inserted++;
    console.log(`  [${s.category}/${s.status}] ${s.question_variants[0]} — cleared ${del.rowCount ?? 0}, inserted 1`);
  }

  console.log(`✓ Done. Cleared ${deleted} old rows, inserted ${inserted} fresh.`);
  await pool().end();
}

main().catch(async (e) => {
  console.error(e);
  await pool().end().catch(() => {});
  process.exit(1);
});
