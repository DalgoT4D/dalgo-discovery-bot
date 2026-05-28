import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, withClient } from '@/lib/db/client';
import { embed } from '@/lib/embeddings';
import { z } from 'zod';

const KbPatch = z.object({
  category: z
    .enum([
      'data_sources',
      'transforms',
      'dashboards',
      'orchestration',
      'ai',
      'sharing',
      'rbac',
      'security',
      'deployment',
      'pricing',
      'mission',
      'stack',
      'limitations',
      'case_studies',
    ])
    .optional(),
  question_variants: z.array(z.string()).optional(),
  canonical_answer: z.string().optional(),
  status: z.enum(['yes', 'partial', 'no', 'roadmap']).optional(),
  ngo_framing: z.string().nullable().optional(),
  evidence: z.array(z.string()).optional(),
  notes_for_sales: z.string().nullable().optional(),
});

function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const { rows } = await query('SELECT * FROM dalgo_knowledge_base WHERE id = $1', [id]);
  if (!rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ item: rows[0] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const patch = KbPatch.parse(await req.json());
  const updatedBy = session.user.email ?? 'admin';

  const needsReembed =
    patch.question_variants !== undefined || patch.canonical_answer !== undefined;

  type PriorRow = {
    category: string;
    question_variants: string[];
    canonical_answer: string;
    status: string | null;
    ngo_framing: string | null;
    evidence: string[] | null;
    notes_for_sales: string | null;
  };

  type Outcome =
    | { kind: 'not_found' }
    | { kind: 'ok'; row: Record<string, unknown> };

  const outcome = await withClient<Outcome>(async (client) => {
    await client.query('BEGIN');
    try {
      // 1. Read + lock the current row
      const cur = await client.query<PriorRow>(
        `SELECT category, question_variants, canonical_answer, status,
                ngo_framing, evidence, notes_for_sales
           FROM dalgo_knowledge_base
          WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (cur.rows.length === 0) {
        await client.query('ROLLBACK');
        return { kind: 'not_found' };
      }
      const prev = cur.rows[0];

      // 2. Snapshot the prior state into dalgo_kb_versions
      await client.query(
        `INSERT INTO dalgo_kb_versions
           (kb_id, category, question_variants, canonical_answer, status,
            ngo_framing, evidence, notes_for_sales, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          id,
          prev.category,
          prev.question_variants,
          prev.canonical_answer,
          prev.status,
          prev.ngo_framing,
          prev.evidence ?? [],
          prev.notes_for_sales,
          updatedBy,
        ],
      );

      // 3. Re-embed if text changed (use prior row values when patch omits them)
      let newEmbedding: string | null = null;
      if (needsReembed) {
        const qv = patch.question_variants ?? prev.question_variants;
        const ans = patch.canonical_answer ?? prev.canonical_answer;
        const vec = await embed(`${qv.join(' | ')}\n\n${ans}`);
        newEmbedding = vectorLiteral(vec);
      }

      // 4. Build dynamic SET clause (preserve existing behavior)
      const updates: string[] = ['last_verified = now()', 'updated_at = now()'];
      const values: unknown[] = [];
      let i = 1;
      for (const [k, v] of Object.entries(patch)) {
        updates.push(`${k} = $${i++}`);
        values.push(v);
      }
      if (newEmbedding !== null) {
        updates.push(`embedding = $${i++}::vector`);
        values.push(newEmbedding);
      }
      values.push(id);

      const upd = await client.query(
        `UPDATE dalgo_knowledge_base SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
        values,
      );

      await client.query('COMMIT');
      return { kind: 'ok', row: upd.rows[0] };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore — original error is more informative
      }
      throw err;
    }
  });

  if (outcome.kind === 'not_found') {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json({ item: outcome.row });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  await query('DELETE FROM dalgo_knowledge_base WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
