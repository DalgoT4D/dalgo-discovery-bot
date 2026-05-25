// lib/blogs/upsert.ts
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query, withClient } from '@/lib/db/client';
import type { EmbeddedChunk, ParsedArticle, UpsertResult } from './types';

function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

export interface UpsertInput extends ParsedArticle {
  articleContext: string;
}

export async function upsertArticle(
  article: UpsertInput,
  chunks: EmbeddedChunk[],
): Promise<UpsertResult> {
  const contentHash = createHash('sha256').update(article.contentMd).digest('hex');

  // Try to find existing article
  const existing = await query<{ id: string; content_hash: string; article_context: string | null }>(
    'SELECT id, content_hash, article_context FROM dalgo_blog_articles WHERE url = $1',
    [article.url],
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (row.content_hash === contentHash && row.article_context) {
      // Nothing changed and context already populated → skip
      await query('UPDATE dalgo_blog_articles SET last_fetched_at = now() WHERE id = $1', [row.id]);
      return { kind: 'skipped', articleId: row.id, chunkCount: chunks.length };
    }

    // Updated: replace chunks + update article row, transactionally on a single connection
    await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        await client.query('DELETE FROM dalgo_blog_chunks WHERE article_id = $1', [row.id]);
        await client.query(
          `UPDATE dalgo_blog_articles
             SET title=$1, author=$2, published_at=$3, excerpt=$4,
                 content_md=$5, content_hash=$6, article_context=$7,
                 last_fetched_at=now()
           WHERE id=$8`,
          [
            article.title,
            article.author,
            article.publishedAt,
            article.excerpt,
            article.contentMd,
            contentHash,
            article.articleContext,
            row.id,
          ],
        );
        await insertChunksOnClient(client, row.id, chunks);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    });
    return { kind: 'updated', articleId: row.id, chunkCount: chunks.length };
  }

  // New: insert article + chunks (transactionally on a single connection)
  const articleId = await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO dalgo_blog_articles
           (url, title, category, author, published_at, excerpt, content_md, content_hash, article_context)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          article.url,
          article.title,
          article.category ?? 'dalgo',
          article.author,
          article.publishedAt,
          article.excerpt,
          article.contentMd,
          contentHash,
          article.articleContext,
        ],
      );
      const id = inserted.rows[0].id;
      await insertChunksOnClient(client, id, chunks);
      await client.query('COMMIT');
      return id;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  });

  return { kind: 'new', articleId, chunkCount: chunks.length };
}

async function insertChunksOnClient(
  client: PoolClient,
  articleId: string,
  chunks: EmbeddedChunk[],
): Promise<void> {
  for (const c of chunks) {
    await client.query(
      `INSERT INTO dalgo_blog_chunks
        (article_id, chunk_index, chunk_text, contextual_text, embedding)
       VALUES ($1,$2,$3,$4,$5::vector)`,
      [articleId, c.chunkIndex, c.chunkText, c.contextualText, vectorLiteral(c.embedding)],
    );
  }
}
