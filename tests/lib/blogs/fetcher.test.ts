// tests/lib/blogs/fetcher.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fetchPost } from '@/lib/blogs/fetcher';

describe('fetchPost', () => {
  let cacheDir: string;
  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), 'blog-fetch-'));
  });

  it('fetches from network and writes to cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html>hello</html>',
    });
    const url = 'https://example.com/post-1/';
    const result = await fetchPost(url, { cacheDir, fetchFn: fetchMock as any });
    expect(result.html).toBe('<html>hello</html>');
    expect(result.fromCache).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(readdirSync(cacheDir).length).toBe(1);
    rmSync(cacheDir, { recursive: true });
  });

  it('returns cached content on second call (no network)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html>cached</html>',
    });
    const url = 'https://example.com/post-2/';
    await fetchPost(url, { cacheDir, fetchFn: fetchMock as any });
    const second = await fetchPost(url, { cacheDir, fetchFn: fetchMock as any });
    expect(second.html).toBe('<html>cached</html>');
    expect(second.fromCache).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce(); // still only one network call
    rmSync(cacheDir, { recursive: true });
  });

  it('throws on non-OK response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(
      fetchPost('https://example.com/missing/', { cacheDir, fetchFn: fetchMock as any }),
    ).rejects.toThrow(/404/);
    rmSync(cacheDir, { recursive: true });
  });
});
