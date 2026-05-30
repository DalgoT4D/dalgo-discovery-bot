import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocPage } from '@/lib/docs/parser';

const INTRO = readFileSync(join(__dirname, '../../fixtures/docs/intro.html'), 'utf8');

describe('parseDocPage', () => {
  it('extracts the page title (stripping the " | Dalgo" suffix)', () => {
    const parsed = parseDocPage(INTRO, 'https://dalgot4d.github.io/dalgo_docs/docs/intro');
    expect(parsed.title.toLowerCase()).toContain('welcome to dalgo');
    expect(parsed.title).not.toContain('| Dalgo');
  });

  it('extracts the main article content as markdown (no nav/footer chrome)', () => {
    const parsed = parseDocPage(INTRO, 'https://dalgot4d.github.io/dalgo_docs/docs/intro');
    expect(parsed.contentMd.length).toBeGreaterThan(100);
    // Should not contain Docusaurus navigation chrome
    expect(parsed.contentMd).not.toMatch(/tableOfContents|theme-doc-toc|navbar|edit this page/i);
  });

  it('carries the source url through to the output', () => {
    const url = 'https://dalgot4d.github.io/dalgo_docs/docs/intro';
    expect(parseDocPage(INTRO, url).url).toBe(url);
  });
});
