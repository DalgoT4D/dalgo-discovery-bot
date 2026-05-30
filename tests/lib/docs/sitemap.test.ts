import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSitemap } from '@/lib/docs/sitemap';

const FIXTURE = readFileSync(join(__dirname, '../../fixtures/docs/sitemap.xml'), 'utf8');

describe('parseSitemap', () => {
  it('extracts every <loc> URL from the sitemap', () => {
    const urls = parseSitemap(FIXTURE);
    expect(urls.length).toBeGreaterThan(20);
    expect(urls.some((u) => u.endsWith('/docs/intro'))).toBe(true);
  });

  it('rewrites host to canonicalHost when provided', () => {
    const urls = parseSitemap(FIXTURE, 'https://dalgot4d.github.io');
    expect(urls.every((u) => u.startsWith('https://dalgot4d.github.io/'))).toBe(true);
    expect(urls.some((u) => u.includes('dalgo.github.io'))).toBe(false);
  });

  it('returns inputs unchanged when canonicalHost is omitted', () => {
    const urls = parseSitemap(FIXTURE);
    expect(urls.some((u) => u.startsWith('https://dalgo.github.io/'))).toBe(true);
  });
});
