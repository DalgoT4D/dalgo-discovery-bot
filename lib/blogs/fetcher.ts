// lib/blogs/fetcher.ts
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RawPost } from './types';

const UA = 'DalgoDiscoveryBot/1.0 (+https://dalgo.org)';
const DEFAULT_CACHE_DIR = '.cache/blogs';

export interface FetchOpts {
  cacheDir?: string;
  fetchFn?: typeof fetch;
}

function cacheKey(url: string): string {
  return createHash('sha1').update(url).digest('hex') + '.html';
}

export async function fetchPost(url: string, opts: FetchOpts = {}): Promise<RawPost> {
  const cacheDir = opts.cacheDir ?? DEFAULT_CACHE_DIR;
  const fetchFn = opts.fetchFn ?? fetch;
  mkdirSync(cacheDir, { recursive: true });
  const cachePath = join(cacheDir, cacheKey(url));

  if (existsSync(cachePath)) {
    return {
      url,
      html: readFileSync(cachePath, 'utf8'),
      fetchedAt: new Date(),
      fromCache: true,
    };
  }

  const res = await fetchFn(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Fetch ${url} failed: HTTP ${res.status}`);
  const html = await res.text();
  writeFileSync(cachePath, html, 'utf8');
  return { url, html, fetchedAt: new Date(), fromCache: false };
}
