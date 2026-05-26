import 'dotenv/config';
import { pool, query } from '@/lib/db/client';
import { embed } from '@/lib/embeddings';

async function main() {
  const targetIds = process.argv.slice(2);
  if (targetIds.length === 0) {
    console.error('Usage: tsx scripts/reembed-kb-row.ts <kb-id> [<kb-id> ...]');
    process.exit(1);
  }
  for (const id of targetIds) {
    const { rows } = await query<{ question_variants: string[]; canonical_answer: string }>(
      'SELECT question_variants, canonical_answer FROM dalgo_knowledge_base WHERE id = $1',
      [id],
    );
    if (rows.length === 0) {
      console.error(`[reembed] no row found for id=${id}`);
      continue;
    }
    const text = `${rows[0].question_variants.join(' | ')}\n\n${rows[0].canonical_answer}`;
    const vec = await embed(text);
    const lit = `[${vec.join(',')}]`;
    await query('UPDATE dalgo_knowledge_base SET embedding = $1::vector, updated_at = now() WHERE id = $2', [lit, id]);
    console.log(`[reembed] updated ${id}`);
  }
  await pool().end();
}
main().catch(async (e) => { console.error(e); await pool().end().catch(() => {}); process.exit(1); });
