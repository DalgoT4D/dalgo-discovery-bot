import { describe, it, expect, vi } from 'vitest';

vi.mock('ai', () => ({
  generateText: vi.fn(async () => ({
    text: JSON.stringify({
      action: 'edit',
      target_kb_id: '11111111-1111-1111-1111-111111111111',
      draft: { question_variants: ['Does Dalgo do qualitative analysis?'], canonical_answer: 'No, not as of now.', status: 'no', evidence: [] },
    }),
  })),
}));
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: () => 'model' }));

describe('draftKbFix', () => {
  it('returns a parsed edit-or-create draft', async () => {
    const { draftKbFix } = await import('@/lib/llm/draft-kb-fix');
    const out = await draftKbFix({
      question: 'does dalgo do qualitative analysis?',
      wrongAnswer: 'Yes, Dalgo does qualitative analysis.',
      reason: 'It does not.',
      suggestedAnswer: 'No, not as of now.',
      candidates: [{ kb_id: '11111111-1111-1111-1111-111111111111', question: 'qual?', snippet: 'Dalgo can...' }],
    });
    expect(out.action).toBe('edit');
    expect(out.target_kb_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(out.draft.status).toBe('no');
    expect(out.draft.canonical_answer).toContain('No');
  });
});
