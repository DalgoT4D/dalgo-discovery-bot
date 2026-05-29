import { query } from '../client';
import { embed } from '@/lib/embeddings';

export interface PatternHit {
  id: string;
  archetype: string;
  consultant_framing: string;
  dalgo_response: string;
  evidence_urls: string[];
  problem_phrasing: string[];
  distance?: number;
  rank?: number;
}

function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

export async function vectorSearchPatterns(q: string, topK = 10): Promise<PatternHit[]> {
  const e = await embed(q);
  const { rows } = await query<PatternHit>(
    `SELECT id, archetype, consultant_framing, dalgo_response, evidence_urls, problem_phrasing,
            (embedding <=> $1::vector)::float AS distance
       FROM dalgo_problem_patterns
   ORDER BY embedding <=> $1::vector
      LIMIT $2`,
    [vectorLiteral(e), topK],
  );
  return rows;
}

export async function lexicalSearchPatterns(q: string, topK = 10): Promise<PatternHit[]> {
  const { rows } = await query<PatternHit>(
    `SELECT id, archetype, consultant_framing, dalgo_response, evidence_urls, problem_phrasing,
            ts_rank_cd(tsv, plainto_tsquery('english', $1))::float AS rank
       FROM dalgo_problem_patterns
      WHERE tsv @@ plainto_tsquery('english', $1)
   ORDER BY rank DESC
      LIMIT $2`,
    [q, topK],
  );
  return rows;
}
