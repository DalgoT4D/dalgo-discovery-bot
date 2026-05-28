import 'dotenv/config';
import { pool } from '@/lib/db/client';
import { createEvalCase, getEvalCaseByKey } from '@/lib/db/queries/eval-cases';
import { citationCases as CITATIONS } from '@/lib/llm/eval/cases/citations';
import { guardrailCases as GUARDRAILS } from '@/lib/llm/eval/cases/guardrails';
import { problemStatementCases as PROBLEM_STATEMENTS } from '@/lib/llm/eval/cases/problem-statements';
import { structureCases as STRUCTURE } from '@/lib/llm/eval/cases/structure';
import { toolNameCases as TOOL_NAMES } from '@/lib/llm/eval/cases/tool-names';
import type { EvalCase } from '@/lib/llm/eval/cases/types';

const ALL: EvalCase[] = [
  ...CITATIONS,
  ...GUARDRAILS,
  ...PROBLEM_STATEMENTS,
  ...STRUCTURE,
  ...TOOL_NAMES,
];

async function main() {
  let created = 0;
  let skipped = 0;
  for (const c of ALL) {
    const existing = await getEvalCaseByKey(c.id);
    if (existing) {
      skipped++;
      continue;
    }
    await createEvalCase({
      case_key: c.id,
      bucket: c.bucket,
      input: c.input,
      expected: c.expected as Record<string, unknown>,
      judges: c.judge,
      enabled: true,
      notes: null,
      updated_by: 'seed',
    });
    created++;
  }
  console.log(
    `Seeded eval cases. created=${created} skipped=${skipped} total_source=${ALL.length}`,
  );
  await pool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
