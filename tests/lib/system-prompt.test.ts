import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';
import { staticSystem, buildSystemPrompt } from '@/lib/llm/system-prompt';
import { __resetForTests } from '@/lib/llm/prompts';

describe('staticSystem (async, DB-backed)', () => {
  beforeEach(() => __resetForTests());

  it('returns a Promise<string> that includes all 5 sections joined', async () => {
    const result = staticSystem();
    expect(result).toBeInstanceOf(Promise);
    const text = await result;
    expect(text).toContain('Dalgo Discovery Assistant');         // intro_and_rules
    expect(text).toContain('search_dalgo_kb');                    // tools_inventory
    expect(text).toContain('Consultant mode');                    // consultant_mode
    expect(text).toContain('Hard boundary');                      // dalgo_vs_3rd_party
    expect(text).toContain('Fit Assessment Mode');                // fit_assessment
  });

  it('reflects DB edits on the next call after invalidation', async () => {
    const { invalidatePromptCache } = await import('@/lib/llm/prompts');
    const { rows } = await query<{ content: string }>(
      `SELECT content FROM dalgo_prompts WHERE key = 'intro_and_rules'`,
    );
    if (!rows[0]) {
      throw new Error("Seed row 'intro_and_rules' missing — apply scripts/migrations/001_prompts.sql");
    }
    const originalContent = rows[0].content;
    try {
      await query(
        `UPDATE dalgo_prompts SET content = $1, updated_by = 'test', updated_at = now()
          WHERE key = 'intro_and_rules'`,
        ['MUTATED_FOR_TEST'],
      );
      invalidatePromptCache('intro_and_rules');
      const text = await staticSystem();
      expect(text).toContain('MUTATED_FOR_TEST');
    } finally {
      await query(
        `UPDATE dalgo_prompts SET content = $1 WHERE key = 'intro_and_rules'`,
        [originalContent],
      );
      invalidatePromptCache('intro_and_rules');
    }
  });

  it('buildSystemPrompt appends NGO context block', async () => {
    const text = await buildSystemPrompt({
      ngo_summary: 'A health NGO.',
      ngo_systems: 'KoboToolbox',
      data_types: ['enrollment'],
    });
    expect(text).toContain('A health NGO.');
    expect(text).toContain('KoboToolbox');
  });

  afterAll(async () => { await pool().end(); });
});
