import 'dotenv/config';
import { runOne, type RunResult } from '@/lib/llm/eval/runner';
import { writeReport } from '@/lib/llm/eval/report';
import { pool } from '@/lib/db/client';

// Re-run a targeted subset of eval cases by id, e.g.:
//   npm run eval:case gr-01 gr-03 st-01
// Writes the same enriched report (with per-vote judge breakdown + bot
// response) so you can see *why* specific cases failed without re-running all.
async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.error('usage: tsx scripts/run-eval-cases.ts <case-id> [<case-id> ...]');
    process.exit(1);
  }
  console.log(`[eval:case] running ${ids.length} case(s): ${ids.join(', ')}`);

  const results: RunResult[] = [];
  for (const id of ids) {
    try {
      const r = await runOne(id);
      results.push(r);
      console.log(`${r.pass ? 'PASS' : 'FAIL'} ${id} — ${r.judgeResults.map((j) => j.notes).join(' · ')}`);
    } catch (e) {
      console.error(`ERROR ${id}:`, e);
    }
  }

  const path = await writeReport(results);
  const passed = results.filter((r) => r.pass).length;
  console.log(`[eval:case] done. ${passed}/${results.length} passed. Report: ${path}`);
  await pool().end();
}

main().catch(async (e) => {
  console.error('[eval:case] fatal:', e);
  await pool().end().catch(() => {});
  process.exit(1);
});
