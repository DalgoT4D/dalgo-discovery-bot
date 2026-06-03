import type { PoolClient } from 'pg';
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

// ─── Transaction-aware write helpers (used by the resolve endpoint, Task 8) ───
// The caller owns BEGIN/COMMIT. These helpers just run their statements on the
// provided PoolClient and never open their own transaction.

export interface KbInsert {
  category: string;
  question_variants: string[];
  canonical_answer: string;
  status: 'yes' | 'partial' | 'no' | 'roadmap';
  ngo_framing: string | null;
  evidence: string[];
  notes_for_sales: string | null;
  embeddingLiteral: string;          // `[..1536..]`
  source: 'seed' | 'admin_manual' | 'promoted_from_conversation' | 'promoted_from_unanswered' | 'wrong_answer_fix';
  source_message_id: string | null;
  author_email: string | null;
}

export async function insertKbEntryTx(client: PoolClient, e: KbInsert): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO dalgo_knowledge_base
       (category, question_variants, canonical_answer, status, ngo_framing, evidence,
        notes_for_sales, embedding, last_verified, source, source_message_id, author_email)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::vector, now(), $9,$10,$11)
     RETURNING id`,
    [e.category, e.question_variants, e.canonical_answer, e.status, e.ngo_framing,
     e.evidence, e.notes_for_sales, e.embeddingLiteral, e.source, e.source_message_id, e.author_email],
  );
  return rows[0].id;
}

export interface KbUpdate {
  question_variants: string[];
  canonical_answer: string;
  status: 'yes' | 'partial' | 'no' | 'roadmap';
  ngo_framing?: string | null;
  evidence?: string[];
  notes_for_sales?: string | null;
}

export async function versionAndUpdateKbTx(
  client: PoolClient, id: string, patch: KbUpdate, updatedBy: string, embeddingLiteral: string,
): Promise<void> {
  // 1. Read + lock the current row (snapshot prior state before update)
  const cur = await client.query<{
    category: string;
    question_variants: string[];
    canonical_answer: string;
    status: string;
    ngo_framing: string | null;
    evidence: string[] | null;
    notes_for_sales: string | null;
  }>(
    `SELECT category, question_variants, canonical_answer, status, ngo_framing, evidence, notes_for_sales
       FROM dalgo_knowledge_base WHERE id=$1 FOR UPDATE`,
    [id],
  );
  if (cur.rows.length === 0) throw new Error('kb entry not found');
  const prev = cur.rows[0];

  // 2. Snapshot prior state into dalgo_kb_versions (columns match the PATCH route exactly)
  await client.query(
    `INSERT INTO dalgo_kb_versions
       (kb_id, category, question_variants, canonical_answer, status,
        ngo_framing, evidence, notes_for_sales, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, prev.category, prev.question_variants, prev.canonical_answer, prev.status,
     prev.ngo_framing, prev.evidence ?? [], prev.notes_for_sales, updatedBy],
  );

  // 3. Apply the update
  await client.query(
    `UPDATE dalgo_knowledge_base
        SET question_variants=$1, canonical_answer=$2, status=$3,
            ngo_framing=$4, evidence=$5, notes_for_sales=$6,
            embedding=$7::vector, last_verified=now(), updated_at=now()
      WHERE id=$8`,
    [patch.question_variants, patch.canonical_answer, patch.status,
     patch.ngo_framing ?? prev.ngo_framing, patch.evidence ?? prev.evidence ?? [],
     patch.notes_for_sales ?? prev.notes_for_sales, embeddingLiteral, id],
  );
}
