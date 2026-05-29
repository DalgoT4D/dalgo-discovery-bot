import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArticle } from '@/lib/blogs/parser';

describe('parseArticle', () => {
  const html = readFileSync(
    join(__dirname, '../../fixtures/blogs/post.html'),
    'utf8',
  );
  const raw = {
    url: 'https://projecttech4dev.org/launching-dalgo/',
    html,
    fetchedAt: new Date(),
    fromCache: true,
  };

  it('extracts title from h1 or og:title', () => {
    const p = parseArticle(raw);
    expect(p.title.length).toBeGreaterThan(5);
    expect(p.title.toLowerCase()).toContain('dalgo');
  });

  it('returns content as non-empty markdown', () => {
    const p = parseArticle(raw);
    expect(p.contentMd.length).toBeGreaterThan(200);
    // markdown, not raw HTML
    expect(p.contentMd).not.toMatch(/<div/);
    expect(p.contentMd).not.toMatch(/<script/);
  });

  it('extracts an ISO publishedAt when present', () => {
    const p = parseArticle(raw);
    if (p.publishedAt) {
      expect(p.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('strips boilerplate (no nav/footer/related-posts markup in content_md)', () => {
    const p = parseArticle(raw);
    expect(p.contentMd.toLowerCase()).not.toContain('related posts');
    expect(p.contentMd.toLowerCase()).not.toContain('copyright');
  });
});
