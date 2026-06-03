import { describe, it, expect, vi } from 'vitest';

vi.mock('ai', () => ({
  generateText: vi.fn(async () => ({
    text: JSON.stringify({
      structure_pass: true,
      uncertainty_pass: true,
      honesty_pass: true,
      convey_pass: false,
      overall_pass: true,
      reason: 'did not state it',
    }),
  })),
}));
vi.mock('@/lib/llm/client', () => ({ anthropic: () => 'model' }));

describe('llm-judge answer_must_convey', () => {
  it('fails when the model says the answer did not convey the required point', async () => {
    const { llmJudge } = await import('@/lib/llm/eval/judges/llm-judge');
    const res = await llmJudge({
      case: {
        id: 'x',
        input: 'q',
        bucket: 'guardrails',
        judge: ['llm-judge'],
        expected: { answer_must_convey: 'Dalgo does not do qualitative analysis' },
      },
      response: 'Yes Dalgo does qualitative analysis.',
    });
    expect(res.pass).toBe(false);
  });

  it('passes when the model says the answer conveyed the required point', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        structure_pass: true,
        uncertainty_pass: true,
        honesty_pass: true,
        convey_pass: true,
        overall_pass: true,
        reason: 'correctly stated it',
      }),
    } as any);

    const { llmJudge } = await import('@/lib/llm/eval/judges/llm-judge');
    const res = await llmJudge({
      case: {
        id: 'y',
        input: 'q',
        bucket: 'guardrails',
        judge: ['llm-judge'],
        expected: { answer_must_convey: 'Dalgo does not do qualitative analysis' },
      },
      response: 'No, Dalgo does not do qualitative analysis.',
    });
    expect(res.pass).toBe(true);
  });

  it('does not affect pass when answer_must_convey is not set', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        structure_pass: true,
        uncertainty_pass: true,
        honesty_pass: true,
        convey_pass: false,  // even if false, doesn't matter when key not set
        overall_pass: true,
        reason: 'n/a',
      }),
    } as any);

    const { llmJudge } = await import('@/lib/llm/eval/judges/llm-judge');
    const res = await llmJudge({
      case: {
        id: 'z',
        input: 'q',
        bucket: 'guardrails',
        judge: ['llm-judge'],
        expected: {},  // no answer_must_convey
      },
      response: 'Some response.',
    });
    expect(res.pass).toBe(true);
  });
});
