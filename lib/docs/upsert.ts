import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query, withClient } from '@/lib/db/client';
import type { EmbeddedDocChunk, ParsedDocPage, DocUpsertResult } from './types';

function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

export async function upsertDocPage(
  page: ParsedDocPage,
  chunks: EmbeddedDocChunk[],
): Promise<DocUpsertResult> {
  const contentHash = createHash('sha256').update(page.contentMd).digest('hex');

  const existing = await query<{ id: string; content_hash: string }>(
    'SELECT id, content_hash FROM dalgo_doc_pages WHERE url = $1',
    [page.url],
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (row.content_hash === contentHash) {
      await query('UPDATE dalgo_doc_pages SET last_fetched_at = now() WHERE id = $1', [row.id]);
      return { kind: 'skipped', pageId: row.id, chunkCount: chunks.length };
    }
    await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        await client.query('DELETE FROM dalgo_doc_chunks WHERE page_id = $1', [row.id]);
        await client.query(
          `UPDATE dalgo_doc_pages
             SET title=$1, content_md=$2, content_hash=$3, last_fetched_at=now()
           WHERE id=$4`,
          [page.title, page.contentMd, contentHash, row.id],
        );
        await insertChunksOnClient(client, row.id, chunks);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    });
    return { kind: 'updated', pageId: row.id, chunkCount: chunks.length };
  }

  const pageId = await withClient<string>(async (client) => {
    await client.query('BEGIN');
    try {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO dalgo_doc_pages (url, title, content_md, content_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [page.url, page.title, page.contentMd, contentHash],
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

  return { kind: 'new', pageId, chunkCount: chunks.length };
}

async function insertChunksOnClient(
  client: PoolClient,
  pageId: string,
  chunks: EmbeddedDocChunk[],
): Promise<void> {
  for (const c of chunks) {
    await client.query(
      `INSERT INTO dalgo_doc_chunks (page_id, chunk_index, chunk_text, embedding)
       VALUES ($1, $2, $3, $4::vector)`,
      [pageId, c.chunkIndex, c.chunkText, vectorLiteral(c.embedding)],
    );
  }
}
