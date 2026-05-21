import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';
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

  const needsReembed =
    patch.question_variants !== undefined || patch.canonical_answer !== undefined;
  let newEmbedding: string | null = null;

  if (needsReembed) {
    const { rows } = await query<{ question_variants: string[]; canonical_answer: string }>(
      'SELECT question_variants, canonical_answer FROM dalgo_knowledge_base WHERE id = $1',
      [id]
    );
    if (!rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const qv = patch.question_variants ?? rows[0].question_variants;
    const ans = patch.canonical_answer ?? rows[0].canonical_answer;
    const vec = await embed(`${qv.join(' | ')}\n\n${ans}`);
    newEmbedding = vectorLiteral(vec);
  }

  // Build dynamic SET clause
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

  const { rows } = await query(
    `UPDATE dalgo_knowledge_base SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  if (!rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ item: rows[0] });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  await query('DELETE FROM dalgo_knowledge_base WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
