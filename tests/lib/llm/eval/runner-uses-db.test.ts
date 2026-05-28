import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { createEvalCase } from '@/lib/db/queries/eval-cases';
import { __resetForTests as resetCases } from '@/lib/llm/eval/case-source';
import { runOne } from '@/lib/llm/eval/runner';

describe('runner reads from DB', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_cases WHERE case_key LIKE 'runner_%'`);
    resetCases();
  });

  it('runOne can execute a case stored in the DB', async () => {
    await createEvalCase({
      case_key: 'runner_smoke',
      bucket: 'guardrails',
      input: 'What is two plus two?',  // off-topic guardrail trigger
      expected: { must_express_uncertainty: true },
      judges: ['llm-judge'],
      enabled: true,
      notes: 'smoke test',
      updated_by: 'test',
    });
    const result = await runOne('runner_smoke');
    expect(result.id).toBe('runner_smoke');
    expect(result.bucket).toBe('guardrails');
    expect(typeof result.pass).toBe('boolean');
    expect(Array.isArray(result.judgeResults)).toBe(true);
  }, 60_000); // LLM call - allow up to 1 min

  it('runOne result includes botResponse, latencyMs, retrievalTrace', async () => {
    await createEvalCase({
      case_key: 'runner_trace',
      bucket: 'guardrails',
      input: 'What is two plus two?',
      expected: { must_express_uncertainty: true },
      judges: ['llm-judge'],
      enabled: true,
      notes: null,
      updated_by: 'test',
    });
    const result = await runOne('runner_trace');
    expect(typeof result.botResponse).toBe('string');
    expect((result.botResponse ?? '').length).toBeGreaterThan(0);
    expect(typeof result.latencyMs).toBe('number');
    expect((result.latencyMs ?? 0)).toBeGreaterThan(0);
    // retrievalTrace shape is opaque but should be present (not undefined)
    expect(result.retrievalTrace).toBeDefined();
  }, 90_000);

  afterAll(async () => { await pool().end(); });
});
