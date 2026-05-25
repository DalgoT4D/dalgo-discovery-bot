import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractPostUrls } from '@/lib/blogs/indexer';

describe('extractPostUrls', () => {
  it('finds post URLs from a real category page fixture', () => {
    const html = readFileSync(
      join(__dirname, '../../fixtures/blogs/category-page.html'),
      'utf8',
    );
    const urls = extractPostUrls(html, 'dalgo');
    // The fixture has at least 10 post cards
    expect(urls.length).toBeGreaterThanOrEqual(10);
    // Each url should look like a post (no /blogs/, /category/, /about-us/, etc.)
    for (const u of urls) {
      expect(u.url).toMatch(/^https:\/\/projecttech4dev\.org\/[a-z0-9-]+\/$/);
      expect(u.url).not.toMatch(/(blogs|category|about-us|careers|contact-us|privacy|feed)\/$/);
      expect(u.category).toBe('dalgo');
    }
  });

  it('deduplicates URLs found multiple times on the page', () => {
    const html = readFileSync(
      join(__dirname, '../../fixtures/blogs/category-page.html'),
      'utf8',
    );
    const urls = extractPostUrls(html, 'dalgo');
    const uniq = new Set(urls.map((u) => u.url));
    expect(uniq.size).toBe(urls.length);
  });
});
