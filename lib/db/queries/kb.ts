import { query } from '../client';
import { embed } from '@/lib/embeddings';

export interface KbHit {
  id: string;
  category: string;
  question_variants: string[];
  canonical_answer: string;
  status: 'yes' | 'partial' | 'no' | 'roadmap';
  ngo_framing: string | null;
  evidence: string[];
  notes_for_sales: string | null;
  score: number;
}

function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

export async function searchKb(
  q: string,
  category?: string,
  topK: number = 5,
): Promise<KbHit[]> {
  const queryEmbedding = await embed(q);
  const { rows } = await query<{
    id: string;
    category: string;
    question_variants: string[];
    canonical_answer: string;
    status: 'yes' | 'partial' | 'no' | 'roadmap';
    ngo_framing: string | null;
    evidence: string[];
    notes_for_sales: string | null;
    distance: number;
  }>(
    'SELECT * FROM kb_match($1::vector, $2, $3)',
    [vectorLiteral(queryEmbedding), topK, category ?? null],
  );
  return rows.map(r => ({
    id: r.id,
    category: r.category,
    question_variants: r.question_variants,
    canonical_answer: r.canonical_answer,
    status: r.status,
    ngo_framing: r.ngo_framing,
    evidence: r.evidence ?? [],
    notes_for_sales: r.notes_for_sales,
    score: 1 - r.distance,
  }));
}
