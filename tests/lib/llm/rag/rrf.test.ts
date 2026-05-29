import { describe, it, expect } from 'vitest';
import { fuseRrf } from '@/lib/llm/rag/rrf';

describe('fuseRrf', () => {
  it('fuses two ranked lists, ties broken by combined ranks', () => {
    const result = fuseRrf({
      lists: [
        [{ id: 'A' }, { id: 'B' }, { id: 'C' }],   // ranks 1,2,3
        [{ id: 'B' }, { id: 'D' }, { id: 'A' }],   // ranks 1,2,3
      ],
      k: 60,
    });
    // B appears in both at rank 1 + 1 → highest score
    expect(result[0].item.id).toBe('B');
    // A and (D|C) follow
    expect(result.map(r => r.item.id).slice(0, 2)).toEqual(['B', 'A']);
  });

  it('applies a multiplicative boost to flagged sources', () => {
    const result = fuseRrf({
      lists: [
        [{ id: 'X', source: 'curated' }, { id: 'Y', source: 'blog' }],
        [{ id: 'Y', source: 'blog' }, { id: 'X', source: 'curated' }],
      ],
      k: 60,
      boostBySource: { curated: 1.5 },
    });
    expect(result[0].item.id).toBe('X');
  });

  it('limits output to topK', () => {
    const lists = [[{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }]];
    const result = fuseRrf({ lists, k: 60, topK: 2 });
    expect(result.length).toBe(2);
  });
});
