import 'dotenv/config';
import { runAll } from '@/lib/llm/eval/runner';
import { writeReport } from '@/lib/llm/eval/report';
import { pool } from '@/lib/db/client';

async function main() {
  console.log('[eval:new] starting 50-case eval suite...');
  const results = await runAll();
  const path = await writeReport(results);
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  console.log(`[eval:new] done. ${passed}/${total} passed. Report: ${path}`);
  await pool().end();
}

main().catch(async (e) => {
  console.error('[eval:new] fatal:', e);
  await pool().end().catch(() => {});
  process.exit(1);
});
