import { embedBatch } from '@/lib/embeddings';
import { chunkMarkdown } from '@/lib/blogs/chunker';
import { query } from '@/lib/db/client';
import { parseSitemap } from './sitemap';
import { parseDocPage } from './parser';
import { upsertDocPage } from './upsert';
import type { DocsJobSummary, EmbeddedDocChunk } from './types';

const UA = 'DalgoDiscoveryBot/1.0 (+https://dalgo.org)';
const DEFAULT_SITEMAP = 'https://dalgot4d.github.io/dalgo_docs/sitemap.xml';

export interface IngestDocsOpts {
  sitemapUrl?: string;
  fetchFn?: typeof fetch;
  jobId?: string;
  onProgress?: (s: DocsJobSummary) => Promise<void> | void;
}

async function persistProgress(jobId: string, s: DocsJobSummary): Promise<void> {
  await query(
    `UPDATE doc_refresh_jobs
       SET pages_seen=$1, pages_new=$2, pages_updated=$3, pages_skipped=$4
     WHERE id=$5`,
    [s.pagesSeen, s.pagesNew, s.pagesUpdated, s.pagesSkipped, jobId],
  );
}

async function finishJob(jobId: string, ok: boolean, error?: string): Promise<void> {
  await query(
    `UPDATE doc_refresh_jobs
       SET status=$1, finished_at=now(), error=$2
     WHERE id=$3`,
    [ok ? 'succeeded' : 'failed', error ?? null, jobId],
  );
}

export async function runDocsIngest(opts: IngestDocsOpts = {}): Promise<DocsJobSummary> {
  const sitemapUrl = opts.sitemapUrl ?? DEFAULT_SITEMAP;
  const fetchFn = opts.fetchFn ?? fetch;
  const canonicalHost = new URL(sitemapUrl).origin;

  if (opts.jobId) {
    await query(
      `UPDATE doc_refresh_jobs SET status='running', started_at=now() WHERE id=$1`,
      [opts.jobId],
    );
  }

  const summary: DocsJobSummary = { pagesSeen: 0, pagesNew: 0, pagesUpdated: 0, pagesSkipped: 0 };

  try {
    const sitemapRes = await fetchFn(sitemapUrl, { headers: { 'User-Agent': UA } });
    if (!sitemapRes.ok) throw new Error(`sitemap fetch failed: HTTP ${sitemapRes.status}`);
    const xml = await sitemapRes.text();
    const urls = parseSitemap(xml, canonicalHost).filter(
      (u) => !u.endsWith('/search') && !u.endsWith('/search/'),
    );

    for (const url of urls) {
      summary.pagesSeen++;
      try {
        const res = await fetchFn(url, { headers: { 'User-Agent': UA } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        const parsed = parseDocPage(html, url);
        if (parsed.contentMd.length < 50) continue;
        const chunks = chunkMarkdown(parsed.contentMd);
        if (chunks.length === 0) continue;
        const embeddings = await embedBatch(chunks.map((c) => c.chunkText));
        const embedded: EmbeddedDocChunk[] = chunks.map((c, i) => ({
          chunkIndex: c.chunkIndex,
          chunkText: c.chunkText,
          embedding: embeddings[i],
        }));
        const result = await upsertDocPage(parsed, embedded);
        if (result.kind === 'new') summary.pagesNew++;
        else if (result.kind === 'updated') summary.pagesUpdated++;
        else summary.pagesSkipped++;
      } catch (e) {
        console.error(`[docs] ingest failed for ${url}:`, e);
      } finally {
        if (opts.jobId) await persistProgress(opts.jobId, summary);
        if (opts.onProgress) await opts.onProgress(summary);
      }
    }

    if (opts.jobId) await finishJob(opts.jobId, true);
    return summary;
  } catch (e) {
    summary.error = String(e);
    if (opts.jobId) await finishJob(opts.jobId, false, String(e));
    return summary;
  }
}
