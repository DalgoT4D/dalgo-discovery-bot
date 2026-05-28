import { query } from '@/lib/db/client';

export interface KbVersionInput {
  category: string;
  question_variants: string[];
  canonical_answer: string;
  status: string | null;
  ngo_framing: string | null;
  evidence: string[];
  notes_for_sales: string | null;
  updated_by: string;
}

export interface KbVersionRow extends KbVersionInput {
  id: number;
  kb_id: string;
  updated_at: Date;
}

export async function insertKbVersion(kbId: string, input: KbVersionInput): Promise<void> {
  await query(
    `INSERT INTO dalgo_kb_versions
       (kb_id, category, question_variants, canonical_answer, status,
        ngo_framing, evidence, notes_for_sales, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      kbId, input.category, input.question_variants, input.canonical_answer,
      input.status, input.ngo_framing, input.evidence, input.notes_for_sales,
      input.updated_by,
    ],
  );
}

export async function listKbVersions(kbId: string): Promise<KbVersionRow[]> {
  const { rows } = await query<KbVersionRow>(
    `SELECT * FROM dalgo_kb_versions
      WHERE kb_id = $1
      ORDER BY updated_at DESC, id DESC`,
    [kbId],
  );
  return rows;
}

export async function getKbVersion(versionId: number): Promise<KbVersionRow | null> {
  const { rows } = await query<KbVersionRow>(
    `SELECT * FROM dalgo_kb_versions WHERE id = $1`,
    [versionId],
  );
  return rows[0] ?? null;
}
