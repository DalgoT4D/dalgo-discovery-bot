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
    const content = await getPrompt('intro_and_rules');
    expect(content.length).toBeGreaterThan(20);
    expect(__cacheStatsForTests().size).toBe(1);
  });

  it('serves from cache within TTL', async () => {
    await getPrompt('intro_and_rules');
    const statsBefore = __cacheStatsForTests();
    await getPrompt('intro_and_rules');
    const statsAfter = __cacheStatsForTests();
    expect(statsAfter.size).toBe(1);
    expect(statsAfter.lastFetchedAt).toBe(statsBefore.lastFetchedAt);
  });

  it('refetches after TTL expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T10:00:00Z'));
    await getPrompt('intro_and_rules');
    const firstFetched = __cacheStatsForTests().lastFetchedAt;

    vi.setSystemTime(new Date('2026-05-26T10:01:01Z')); // +61s
    await getPrompt('intro_and_rules');
    const secondFetched = __cacheStatsForTests().lastFetchedAt;

    expect(secondFetched).toBeGreaterThan(firstFetched);
  });

  it('throws on missing key', async () => {
    await expect(getPrompt('does_not_exist')).rejects.toThrow(
      /not found in dalgo_prompts/,
    );
  });

  it('invalidatePromptCache(key) clears that one entry', async () => {
    await getPrompt('intro_and_rules');
    await getPrompt('fit_assessment');
    expect(__cacheStatsForTests().size).toBe(2);
    invalidatePromptCache('intro_and_rules');
    expect(__cacheStatsForTests().size).toBe(1);
  });

  it('invalidatePromptCache() with no key clears all', async () => {
    await getPrompt('intro_and_rules');
    await getPrompt('fit_assessment');
    invalidatePromptCache();
    expect(__cacheStatsForTests().size).toBe(0);
  });

  it('invalidatePromptCache bumps version counter', async () => {
    const v0 = __cacheStatsForTests().version;
    invalidatePromptCache('intro_and_rules');
    expect(__cacheStatsForTests().version).toBe(v0 + 1);
  });

  afterAll(async () => {
    await pool().end();
  });
});
