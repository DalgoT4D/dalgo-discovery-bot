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

// New: lexical KB search for hybrid retrieval
export interface KbLexicalHit {
  id: string;
  category: string;
  question_variants: string[];
  canonical_answer: string;
  status: 'yes' | 'partial' | 'no' | 'roadmap';
  ngo_framing: string | null;
  evidence: string[];
  notes_for_sales: string | null;
  rank: number;
}

export async function lexicalSearchKb(q: string, topK = 20): Promise<KbLexicalHit[]> {
  const { rows } = await query<KbLexicalHit>(
    `SELECT id, category, question_variants, canonical_answer, status, ngo_framing,
            evidence, notes_for_sales,
            ts_rank_cd(tsv, plainto_tsquery('english', $1))::float AS rank
       FROM dalgo_knowledge_base
      WHERE tsv @@ plainto_tsquery('english', $1)
   ORDER BY rank DESC
      LIMIT $2`,
    [q, topK],
  );
  return rows.map(r => ({ ...r, evidence: r.evidence ?? [] }));
}

export interface PromoteKbInput {
  questionVariants: string[];
  canonicalAnswer: string;
  category: string;
  status: 'yes' | 'partial' | 'no' | 'roadmap';
  evidence: string[];
  ngoFraming?: string;
  notesForSales?: string;
  source: 'admin_manual' | 'promoted_from_conversation' | 'promoted_from_unanswered';
  sourceMessageId?: string;
  authorEmail: string;
}

export async function insertKbFromMessage(input: PromoteKbInput): Promise<string> {
  const text = `${input.questionVariants.join(' | ')}\n\n${input.canonicalAnswer}`;
  const embedding = await embed(text);
  const vectorLit = `[${embedding.join(',')}]`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO dalgo_knowledge_base
      (category, question_variants, canonical_answer, status, ngo_framing,
       evidence, notes_for_sales, source, source_message_id, author_email,
       source_audit_date, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_DATE, $11::vector)
     RETURNING id`,
    [
      input.category, input.questionVariants, input.canonicalAnswer, input.status,
      input.ngoFraming ?? null, input.evidence, input.notesForSales ?? null,
      input.source, input.sourceMessageId ?? null, input.authorEmail, vectorLit,
    ],
  );
  return rows[0].id;
}
