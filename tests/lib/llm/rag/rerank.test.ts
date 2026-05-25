import { describe, it, expect, vi } from 'vitest';
import { rerankCandidates } from '@/lib/llm/rag/rerank';

describe('rerankCandidates', () => {
  it('reorders candidates by LLM scores and keeps topK', async () => {
    const candidates = [
      { id: 'A', text: 'noise about cats' },
      { id: 'B', text: 'about Dalgo NGO data platform' },
      { id: 'C', text: 'tangential mention' },
    ];
    const llmMock = vi.fn().mockResolvedValue(JSON.stringify([
      { id: 'A', score: 0 },
      { id: 'B', score: 5 },
      { id: 'C', score: 2 },
    ]));
    const result = await rerankCandidates({
      query: 'NGO using Dalgo',
      candidates,
      topK: 2,
      generate: llmMock,
    });
    expect(result.map(r => r.id)).toEqual(['B', 'C']);
    expect(result[0].rerankScore).toBe(5);
  });

  it('returns candidates unchanged if LLM output is junk', async () => {
    const candidates = [{ id: 'A', text: 'x' }, { id: 'B', text: 'y' }];
    const llmMock = vi.fn().mockResolvedValue('not json');
    const result = await rerankCandidates({
      query: 'q', candidates, topK: 2, generate: llmMock,
    });
    expect(result.length).toBe(2);
  });
});
