import { query } from '../client';
import { embed } from '@/lib/embeddings';

export interface DocChunkHit {
  chunk_id: string;
  page_id: string;
  chunk_text: string;
  page_url: string;
  page_title: string;
  distance?: number;
  rank?: number;
}

function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

export async function vectorSearchDocs(q: string, topK = 20): Promise<DocChunkHit[]> {
  const e = await embed(q);
  const { rows } = await query<DocChunkHit>(
    `SELECT c.id AS chunk_id, c.page_id, c.chunk_text,
            p.url AS page_url, p.title AS page_title,
            (c.embedding <=> $1::vector)::float AS distance
       FROM dalgo_doc_chunks c
       JOIN dalgo_doc_pages p ON p.id = c.page_id
   ORDER BY c.embedding <=> $1::vector
      LIMIT $2`,
    [vectorLiteral(e), topK],
  );
  return rows;
}

export async function lexicalSearchDocs(q: string, topK = 20): Promise<DocChunkHit[]> {
  const { rows } = await query<DocChunkHit>(
    `SELECT c.id AS chunk_id, c.page_id, c.chunk_text,
            p.url AS page_url, p.title AS page_title,
            ts_rank_cd(c.tsv, plainto_tsquery('english', $1))::float AS rank
       FROM dalgo_doc_chunks c
       JOIN dalgo_doc_pages p ON p.id = c.page_id
      WHERE c.tsv @@ plainto_tsquery('english', $1)
   ORDER BY rank DESC
      LIMIT $2`,
    [q, topK],
  );
  return rows;
}
