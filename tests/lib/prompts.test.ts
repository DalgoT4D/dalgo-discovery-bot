import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import 'dotenv/config';
import { pool } from '@/lib/db/client';
import {
  getPrompt,
  invalidatePromptCache,
  __resetForTests,
  __cacheStatsForTests,
} from '@/lib/llm/prompts';

describe('getPrompt', () => {
  beforeEach(() => {
    __resetForTests();
    vi.useRealTimers();
  });

  it('fetches from the DB on first call', async () => {
    const content = await getPrompt('identity');
    expect(content.length).toBeGreaterThan(20);
    expect(__cacheStatsForTests().size).toBe(1);
  });

  it('serves from cache within TTL', async () => {
    await getPrompt('identity');
    const firstFetched = __cacheStatsForTests().entries['identity'];
    await getPrompt('identity');
    const secondFetched = __cacheStatsForTests().entries['identity'];
    expect(__cacheStatsForTests().size).toBe(1);
    expect(secondFetched).toBe(firstFetched);
  });

  it('refetches after TTL expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T10:00:00Z'));
    await getPrompt('identity');
    const firstFetched = __cacheStatsForTests().entries['identity'];

    vi.setSystemTime(new Date('2026-05-26T10:01:01Z')); // +61s
    await getPrompt('identity');
    const secondFetched = __cacheStatsForTests().entries['identity'];

    expect(secondFetched).toBeGreaterThan(firstFetched);
  });

  it('throws on missing key', async () => {
    await expect(getPrompt('does_not_exist')).rejects.toThrow(
      /not found in dalgo_prompts/,
    );
  });

  it('invalidatePromptCache(key) clears that one entry', async () => {
    await getPrompt('identity');
    await getPrompt('fit_assessment');
    expect(__cacheStatsForTests().size).toBe(2);
    invalidatePromptCache('identity');
    expect(__cacheStatsForTests().size).toBe(1);
  });

  it('invalidatePromptCache() with no key clears all', async () => {
    await getPrompt('identity');
    await getPrompt('fit_assessment');
    invalidatePromptCache();
    expect(__cacheStatsForTests().size).toBe(0);
  });

  it('invalidatePromptCache bumps version counter', async () => {
    const v0 = __cacheStatsForTests().version;
    invalidatePromptCache('identity');
    expect(__cacheStatsForTests().version).toBe(v0 + 1);
  });

  afterAll(async () => {
    await pool().end();
  });
});
