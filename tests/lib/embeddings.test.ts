import { describe, it, expect } from 'vitest';
import 'dotenv/config';
import { embed, embedBatch } from '@/lib/embeddings';

const hasKey = Boolean(process.env.OPENAI_API_KEY);

describe('embed', () => {
  it.skipIf(!hasKey)('returns a 1536-dim vector for a string', async () => {
    const vec = await embed('Can Dalgo connect to KoboToolbox?');
    expect(vec).toHaveLength(1536);
    expect(vec.every((n) => typeof n === 'number')).toBe(true);
  });

  it.skipIf(!hasKey)('produces consistent embeddings for the same input', async () => {
    const a = await embed('test');
    const b = await embed('test');
    const dot = a.reduce((s, ai, i) => s + ai * b[i], 0);
    expect(dot).toBeGreaterThan(0.999);
  });

  it.skipIf(!hasKey)('embedBatch returns N vectors for N inputs', async () => {
    const vecs = await embedBatch(['a', 'b', 'c']);
    expect(vecs).toHaveLength(3);
    expect(vecs[0]).toHaveLength(1536);
  });

  it.skipIf(hasKey)('throws a helpful error when OPENAI_API_KEY is missing', async () => {
    // This test only runs when no key is set in the environment, ensuring the
    // singleton client has not been initialized by the other tests.
    await expect(embed('test')).rejects.toThrow(/OPENAI_API_KEY/);
  });
});
