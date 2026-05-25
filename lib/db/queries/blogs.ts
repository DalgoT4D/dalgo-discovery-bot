import { query } from '../client';
import { embed } from '@/lib/embeddings';

export interface BlogChunkHit {
  chunk_id: string;
  article_id: string;
  chunk_text: string;
  article_url: string;
  article_title: string;
  distance?: number;   // present for vector hits
  rank?: number;       // present for lexical hits
}

function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

export async function vectorSearchBlogs(q: string, topK = 20): Promise<BlogChunkHit[]> {
  const e = await embed(q);
  const { rows } = await query<BlogChunkHit>(
    `SELECT c.id AS chunk_id, c.article_id, c.chunk_text,
            a.url AS article_url, a.title AS article_title,
            (c.embedding <=> $1::vector)::float AS distance
       FROM dalgo_blog_chunks c
       JOIN dalgo_blog_articles a ON a.id = c.article_id
   ORDER BY c.embedding <=> $1::vector
      LIMIT $2`,
    [vectorLiteral(e), topK],
  );
  return rows;
}

export async function lexicalSearchBlogs(q: string, topK = 20): Promise<BlogChunkHit[]> {
  const { rows } = await query<BlogChunkHit>(
    `SELECT c.id AS chunk_id, c.article_id, c.chunk_text,
            a.url AS article_url, a.title AS article_title,
            ts_rank_cd(c.tsv, plainto_tsquery('english', $1))::float AS rank
       FROM dalgo_blog_chunks c
       JOIN dalgo_blog_articles a ON a.id = c.article_id
      WHERE c.tsv @@ plainto_tsquery('english', $1)
   ORDER BY rank DESC
      LIMIT $2`,
    [q, topK],
  );
  return rows;
}
