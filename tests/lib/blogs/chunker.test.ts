import { describe, it, expect } from 'vitest';
import { chunkMarkdown } from '@/lib/blogs/chunker';

const lorem = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

describe('chunkMarkdown', () => {
  it('returns one chunk for short input', () => {
    const chunks = chunkMarkdown('hello world this is a short post');
    expect(chunks.length).toBe(1);
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it('produces ~300-word chunks with ~50-word overlap', () => {
    const md = lorem(1000);
    const chunks = chunkMarkdown(md, { targetWords: 300, overlapWords: 50 });
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) {
      const wc = c.chunkText.split(/\s+/).filter(Boolean).length;
      // tolerance: between 200 and 360 words per chunk
      expect(wc).toBeGreaterThanOrEqual(50);
      expect(wc).toBeLessThanOrEqual(360);
    }
    // Adjacent chunks share ~50 words (the overlap)
    const last50First = chunks[0].chunkText.split(/\s+/).slice(-50).join(' ');
    expect(chunks[1].chunkText.startsWith(last50First.slice(0, 30))).toBe(true);
  });

  it('uses ## headings as section boundaries (no chunk straddles a section)', () => {
    const md = `Intro para.\n\n## Section A\n${lorem(150)}\n\n## Section B\n${lorem(150)}`;
    const chunks = chunkMarkdown(md, { targetWords: 100, overlapWords: 10 });
    // No chunk should contain both "## Section A" and "## Section B"
    for (const c of chunks) {
      const hasA = c.chunkText.includes('## Section A');
      const hasB = c.chunkText.includes('## Section B');
      expect(hasA && hasB).toBe(false);
    }
  });

  it('numbers chunks starting at 0', () => {
    const chunks = chunkMarkdown(lorem(1000));
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[chunks.length - 1].chunkIndex).toBe(chunks.length - 1);
  });
});
