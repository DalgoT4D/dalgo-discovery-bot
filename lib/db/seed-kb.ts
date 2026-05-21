import 'dotenv/config';
import { pool, query } from './client';
import { embedBatch } from '@/lib/embeddings';
import { dataSources } from './seed-data/data-sources';
import { transforms } from './seed-data/transforms';
import { dashboards } from './seed-data/dashboards';
import { orchestration } from './seed-data/orchestration';
import { ai } from './seed-data/ai';
import { sharing } from './seed-data/sharing';
import { rbac } from './seed-data/rbac';
import { security } from './seed-data/security';
import { deployment } from './seed-data/deployment';
import { pricing } from './seed-data/pricing';
import { mission } from './seed-data/mission';
import { stack } from './seed-data/stack';
import { limitations } from './seed-data/limitations';
import type { KbSeed } from './seed-data/types';

const all: KbSeed[] = [
  ...dataSources, ...transforms, ...dashboards, ...orchestration,
  ...ai, ...sharing, ...rbac, ...security, ...deployment,
  ...pricing, ...mission, ...stack, ...limitations,
];

function pgVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

async function main() {
  console.log(`Seeding ${all.length} KB entries...`);
  if (all.length !== 131) {
    throw new Error(`Expected 131 entries, got ${all.length}. Check seed files.`);
  }

  if (process.env.SEED_RESET === 'true') {
    console.log('SEED_RESET=true — truncating dalgo_knowledge_base...');
    await query('TRUNCATE dalgo_knowledge_base');
  }

  const batchSize = 50;
  let inserted = 0;
  for (let i = 0; i < all.length; i += batchSize) {
    const slice = all.slice(i, i + batchSize);
    const texts = slice.map(s => `${s.question_variants.join(' | ')}\n\n${s.canonical_answer}`);
    const vectors = await embedBatch(texts);

    // Insert each row with a parameterized query (avoid building a giant single-INSERT)
    for (let j = 0; j < slice.length; j++) {
      const s = slice[j];
      const v = vectors[j];
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
        ]
      );
      inserted++;
    }
    console.log(`  embedded + inserted ${Math.min(i + batchSize, all.length)} / ${all.length}`);
  }

  console.log(`✓ Seeded ${inserted} entries.`);
  await pool().end();
}

main().catch(async (e) => {
  console.error(e);
  await pool().end().catch(() => {});
  process.exit(1);
});
