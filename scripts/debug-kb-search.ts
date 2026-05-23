import 'dotenv/config';
import { searchKb } from '@/lib/db/queries/kb';
import { pool } from '@/lib/db/client';

async function test(q: string, category?: string) {
  console.log('\n=== Query:', JSON.stringify(q), category ? `(category=${category})` : '');
  const hits = await searchKb(q, category, 6);
  for (const h of hits) {
    console.log(`  [${h.category}/${h.status}] score=${h.score.toFixed(2)}  Q: ${h.question_variants[0]}`);
  }
}

async function main() {
  await test('Which NGOs use Dalgo?');
  await test('Which NGOs are Dalgo customers?');
  await test('Who are Dalgo customers?');
  await test('How much does Dalgo cost?');
  await pool().end();
}
main();
