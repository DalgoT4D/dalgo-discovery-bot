import 'dotenv/config';
import { pool, query } from '@/lib/db/client';
import { embedBatch } from '@/lib/embeddings';
import { positioning } from '@/lib/db/seed-data/positioning';
import { pricing } from '@/lib/db/seed-data/pricing';
import { security } from '@/lib/db/seed-data/security';
import { mission } from '@/lib/db/seed-data/mission';
import { dataSources } from '@/lib/db/seed-data/data-sources';
import type { KbSeed } from '@/lib/db/seed-data/types';

// Targeted UPSERT for the June 2026 positioning update.
//
// The live dalgo_knowledge_base contains (a) duplicate rows from earlier
// non-reset `seed:kb` runs and (b) admin-curated rows (wrong-answer fix loop)
// that are NOT in the seed files. So we cannot reset or full-reseed safely.
// This script touches ONLY the new/changed entries below: it deletes any rows
// whose question_variants exactly match (clearing earlier duplicates of these
// specific entries) and inserts one fresh embedded row each. Idempotent.

const NEW_OR_CHANGED: KbSeed[] = [
  ...positioning, // 9 new entries (whole new category)
  pick(pricing, 'Does Dalgo charge per user?'),
  pick(security, 'Is Dalgo DPDP compliant?'),
  pick(mission, 'Who funds or backs Dalgo?'),
  pick(dataSources, 'How many data sources does Dalgo support in total?'), // modified answer
];

function pick(arr: KbSeed[], firstVariant: string): KbSeed {
  const found = arr.find((s) => s.question_variants[0] === firstVariant);
  if (!found) throw new Error(`Seed entry not found for first variant: "${firstVariant}"`);
  return found;
}

function pgVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

async function main() {
  console.log(`Upserting ${NEW_OR_CHANGED.length} positioning entries...`);
  const texts = NEW_OR_CHANGED.map(
    (s) => `${s.question_variants.join(' | ')}\n\n${s.canonical_answer}`,
  );
  const vectors = await embedBatch(texts);

  let inserted = 0;
  let deleted = 0;
  for (let i = 0; i < NEW_OR_CHANGED.length; i++) {
    const s = NEW_OR_CHANGED[i];
    const v = vectors[i];

    // Clear any existing rows with this exact question_variants signature
    // (removes earlier duplicates of this specific entry).
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
    console.log(`  [${s.category}] ${s.question_variants[0]} — cleared ${del.rowCount ?? 0}, inserted 1`);
  }

  console.log(`✓ Done. Cleared ${deleted} old rows, inserted ${inserted} fresh.`);
  await pool().end();
}

main().catch(async (e) => {
  console.error(e);
  await pool().end().catch(() => {});
  process.exit(1);
});
