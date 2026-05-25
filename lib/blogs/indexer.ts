import * as cheerio from 'cheerio';
import type { PostRef } from './types';

// URL slugs we know are NOT blog posts.
const NON_POST_SLUGS = new Set([
  'blogs', 'about-us', 'careers', 'contact-us', 'privacy', 'feed',
  'dalgo', 'glific', 'avni', 'fractional-cxo', 'community-of-practice',
  'data-and-learning', 'events', 'impact-hub', 'code-of-conduct',
]);

export function extractPostUrls(html: string, category: string): PostRef[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const out: PostRef[] = [];

  $('a[href^="https://projecttech4dev.org/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const m = href.match(/^https:\/\/projecttech4dev\.org\/([a-z0-9-]+)\/$/);
    if (!m) return;
    const slug = m[1];
    if (NON_POST_SLUGS.has(slug)) return;
    if (seen.has(href)) return;
    seen.add(href);
    out.push({ url: href, category });
  });

  return out;
}

const UA = 'DalgoDiscoveryBot/1.0 (+https://dalgo.org)';
const DELAY_MS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function listPostUrls(category: string): Promise<PostRef[]> {
  const seen = new Set<string>();
  const out: PostRef[] = [];
  let pageNum = 1;
  const maxPages = 60; // safety cap

  while (pageNum <= maxPages) {
    const url = pageNum === 1
      ? `https://projecttech4dev.org/blogs/?category=${category}`
      : `https://projecttech4dev.org/blogs/page/${pageNum}/?category=${category}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) break;
    const html = await res.text();
    const refs = extractPostUrls(html, category);
    let foundNew = false;
    for (const r of refs) {
      if (!seen.has(r.url)) {
        seen.add(r.url);
        out.push(r);
        foundNew = true;
      }
    }
    if (!foundNew) break;
    pageNum++;
    await sleep(DELAY_MS);
  }

  return out;
}
