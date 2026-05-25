// lib/blogs/ingest.ts
import { embedBatch } from '@/lib/embeddings';
import { query } from '@/lib/db/client';
import { listPostUrls } from './indexer';
import { fetchPost } from './fetcher';
import { parseArticle } from './parser';
import { chunkMarkdown } from './chunker';
import { generateArticleContext } from './contextualizer';
import { upsertArticle } from './upsert';
import type { EmbeddedChunk, JobSummary } from './types';

export interface IngestOpts {
  categories: string[];
  jobId?: string;
  onProgress?: (summary: JobSummary) => Promise<void>;
}

async function startJob(jobId: string | undefined): Promise<string> {
  if (!jobId) {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO blog_refresh_jobs (status) VALUES ('running') RETURNING id`,
    );
    return rows[0].id;
  }
  await query(`UPDATE blog_refresh_jobs SET status='running', started_at=now() WHERE id=$1`, [jobId]);
  return jobId;
}

async function persistProgress(jobId: string, s: JobSummary): Promise<void> {
  await query(
    `UPDATE blog_refresh_jobs
       SET posts_seen=$1, posts_new=$2, posts_updated=$3, posts_skipped=$4
       WHERE id=$5`,
    [s.postsSeen, s.postsNew, s.postsUpdated, s.postsSkipped, jobId],
  );
}

async function finishJob(jobId: string, ok: boolean, error?: string): Promise<void> {
  await query(
    `UPDATE blog_refresh_jobs
       SET status=$1, finished_at=now(), error=$2
       WHERE id=$3`,
    [ok ? 'succeeded' : 'failed', error ?? null, jobId],
  );
}

export async function runIngest(opts: IngestOpts): Promise<JobSummary> {
  const jobId = await startJob(opts.jobId);
  const summary: JobSummary = {
    jobId,
    postsSeen: 0,
    postsNew: 0,
    postsUpdated: 0,
    postsSkipped: 0,
  };

  try {
    const allRefs = (await Promise.all(opts.categories.map(listPostUrls))).flat();

    for (const ref of allRefs) {
      summary.postsSeen++;
      try {
        const raw = await fetchPost(ref.url);
        const parsed = parseArticle(raw);
        parsed.category = ref.category;
        const ctx = await generateArticleContext(parsed);
        const chunks = chunkMarkdown(parsed.contentMd);
        if (chunks.length === 0) continue;
        const contextualTexts = chunks.map((c) => `${ctx}\n\n${c.chunkText}`);
        const embeddings = await embedBatch(contextualTexts);
        const embedded: EmbeddedChunk[] = chunks.map((c, i) => ({
          ...c,
          contextualText: contextualTexts[i],
          embedding: embeddings[i],
        }));
        const result = await upsertArticle(
          { ...parsed, articleContext: ctx },
          embedded,
        );
        if (result.kind === 'new') summary.postsNew++;
        else if (result.kind === 'updated') summary.postsUpdated++;
        else summary.postsSkipped++;
      } catch (e) {
        console.error(`[blogs] ingest failed for ${ref.url}:`, e);
      }
      await persistProgress(jobId, summary);
      if (opts.onProgress) await opts.onProgress(summary);
    }

    await finishJob(jobId, true);
    return summary;
  } catch (e) {
    await finishJob(jobId, false, String(e));
    summary.error = String(e);
    return summary;
  }
}
