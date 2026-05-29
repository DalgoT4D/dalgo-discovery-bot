import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';
import { upsertArticle } from '@/lib/blogs/upsert';

const sampleArticle = {
  url: 'https://example.com/test-article/',
  title: 'Test Article',
  author: 'Test Author',
  publishedAt: '2025-01-01',
  excerpt: 'Excerpt',
  contentMd: 'Body content with enough text to look real. '.repeat(20),
};

const sampleChunks = [
  {
    chunkIndex: 0,
    chunkText: 'chunk 0 text',
    contextualText: 'context. chunk 0 text',
    embedding: Array.from({ length: 1536 }, (_, i) => i / 1536),
  },
  {
    chunkIndex: 1,
    chunkText: 'chunk 1 text',
    contextualText: 'context. chunk 1 text',
    embedding: Array.from({ length: 1536 }, (_, i) => (i + 1) / 1536),
  },
];

describe('upsertArticle', () => {
  beforeEach(async () => {
    await query("DELETE FROM dalgo_blog_articles WHERE url = $1", [sampleArticle.url]);
  });

  it('inserts new article and chunks (kind=new)', async () => {
    const result = await upsertArticle(
      { ...sampleArticle, articleContext: 'A test article context.' },
      sampleChunks,
    );
    expect(result.kind).toBe('new');
    expect(result.chunkCount).toBe(2);
    const { rows } = await query(
      'SELECT COUNT(*)::int AS c FROM dalgo_blog_chunks WHERE article_id = $1',
      [result.articleId],
    );
    expect((rows[0] as { c: number }).c).toBe(2);
  });

  it('skips when content_hash unchanged (kind=skipped)', async () => {
    await upsertArticle({ ...sampleArticle, articleContext: 'ctx' }, sampleChunks);
    const second = await upsertArticle({ ...sampleArticle, articleContext: 'ctx' }, sampleChunks);
    expect(second.kind).toBe('skipped');
  });

  it('replaces chunks when content changes (kind=updated)', async () => {
    await upsertArticle({ ...sampleArticle, articleContext: 'ctx' }, sampleChunks);
    const changed = { ...sampleArticle, contentMd: 'totally different body' };
    const result = await upsertArticle({ ...changed, articleContext: 'ctx' }, [sampleChunks[0]]);
    expect(result.kind).toBe('updated');
    const { rows } = await query(
      'SELECT COUNT(*)::int AS c FROM dalgo_blog_chunks WHERE article_id = $1',
      [result.articleId],
    );
    expect((rows[0] as { c: number }).c).toBe(1);
  });

  afterAll(async () => {
    await query("DELETE FROM dalgo_blog_articles WHERE url = $1", [sampleArticle.url]);
    await pool().end();
  });
});
