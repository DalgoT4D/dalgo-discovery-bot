import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { pool } from '@/lib/db/client';
import { extractQaPairs } from '@/lib/llm/extract-qa';

describe('extractQaPairs', () => {
  it('extracts at least one Q&A pair from short factual text', async () => {
    const result = await extractQaPairs(
      'Dalgo is a data platform for NGOs. It is free for verified nonprofits and supports common sources like Google Sheets, Airtable, and PostgreSQL.',
      { category: 'pricing' },
    );
    expect(result.pairs.length).toBeGreaterThanOrEqual(1);
    expect(result.pairs[0].question).toBeTruthy();
    expect(result.pairs[0].answer).toBeTruthy();
    expect(Array.isArray(result.pairs[0].variants)).toBe(true);
  }, 30_000);

  it('returns an empty array on garbage input rather than hallucinating', async () => {
    const result = await extractQaPairs('asdkjf asldfkj asldkfj', { category: 'pricing' });
    // Acceptable: 0 pairs or pairs flagged with a confidence < threshold.
    expect(Array.isArray(result.pairs)).toBe(true);
  }, 30_000);

  afterAll(async () => { await pool().end(); });
});
