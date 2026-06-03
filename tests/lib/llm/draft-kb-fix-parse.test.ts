import { describe, it, expect, vi, beforeEach } from 'vitest';

// Reset modules so we get a fresh import with our own mock
beforeEach(() => {
  vi.resetModules();
});

describe('draftKbFix – parse-failure path', () => {
  it('throws an unparseable error when model returns garbage', async () => {
    vi.doMock('ai', () => ({
      generateText: vi.fn(async () => ({ text: 'sorry I cannot help' })),
    }));
    vi.doMock('@ai-sdk/anthropic', () => ({ anthropic: () => 'model' }));

    const { draftKbFix } = await import('@/lib/llm/draft-kb-fix');
    await expect(
      draftKbFix({ question: 'q', wrongAnswer: 'w', reason: 'r', candidates: [] }),
    ).rejects.toThrow(/unparseable/);
  });

  it('normalises uppercase action="CREATE" to "create"', async () => {
    vi.doMock('ai', () => ({
      generateText: vi.fn(async () => ({
        text: JSON.stringify({
          action: 'CREATE',
          draft: {
            question_variants: ['Does Dalgo do X?'],
            canonical_answer: 'No.',
            status: 'no',
            evidence: [],
          },
        }),
      })),
    }));
    vi.doMock('@ai-sdk/anthropic', () => ({ anthropic: () => 'model' }));

    const { draftKbFix } = await import('@/lib/llm/draft-kb-fix');
    const out = await draftKbFix({ question: 'q', wrongAnswer: 'w', reason: 'r', candidates: [] });
    expect(out.action).toBe('create');
    expect(out.target_kb_id).toBeUndefined();
  });
});
