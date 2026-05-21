import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { runAll } from '@/lib/llm/eval/runner';
import { pool } from '@/lib/db/client';

const canRun = Boolean(process.env.ANTHROPIC_API_KEY) && Boolean(process.env.OPENAI_API_KEY);

describe('eval suite', () => {
  it.skipIf(!canRun)('passes at least 95% of cases', async () => {
    const results = await runAll();
    const pass = results.filter((r) => r.passed).length;
    const rate = pass / results.length;
    // eslint-disable-next-line no-console
    console.log(`Eval pass rate: ${pass}/${results.length} = ${(rate * 100).toFixed(0)}%`);
    for (const r of results.filter((x) => !x.passed)) {
      // eslint-disable-next-line no-console
      console.log(`  ✗ ${r.case_id}: ${r.reasons.join('; ')}`);
    }
    expect(rate).toBeGreaterThanOrEqual(0.95);
  }, 300_000);

  afterAll(async () => {
    await pool().end();
  });
});
