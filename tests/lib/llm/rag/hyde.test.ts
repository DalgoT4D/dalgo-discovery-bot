import { describe, it, expect, vi } from 'vitest';
import { rewriteQuery } from '@/lib/llm/rag/hyde';

describe('rewriteQuery (HyDE)', () => {
  it('returns three rewrites from the model output', async () => {
    const llmMock = vi.fn().mockResolvedValue(JSON.stringify({
      problem_query: 'NGO with no centralized data infrastructure, scattered Excel',
      capability_query: 'Dalgo onboarding for NGOs starting from zero data maturity',
      evidence_query: 'NGO that consolidated fragmented data into a single warehouse',
    }));
    const result = await rewriteQuery("we don't have any data system", { generate: llmMock });
    expect(result.problem_query).toContain('NGO');
    expect(result.capability_query).toContain('Dalgo');
    expect(result.evidence_query).toContain('NGO');
    expect(llmMock).toHaveBeenCalledOnce();
  });

  it('falls back to the original query when the model returns junk', async () => {
    const llmMock = vi.fn().mockResolvedValue('not json at all');
    const original = 'some user message';
    const result = await rewriteQuery(original, { generate: llmMock });
    expect(result.problem_query).toBe(original);
    expect(result.capability_query).toBe(original);
    expect(result.evidence_query).toBe(original);
  });
});
