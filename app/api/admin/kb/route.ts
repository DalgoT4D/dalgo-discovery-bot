import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';
import { embed } from '@/lib/embeddings';
import { KB_CATEGORIES } from '@/lib/db/seed-data/types';
import { z } from 'zod';

const KbInput = z.object({
  category: z.enum(KB_CATEGORIES),
  question_variants: z.array(z.string().min(1)).min(1),
  canonical_answer: z.string().min(1),
  status: z.enum(['yes', 'partial', 'no', 'roadmap']),
  ngo_framing: z.string().nullable().optional(),
  evidence: z.array(z.string()).optional(),
  notes_for_sales: z.string().nullable().optional(),
});

function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { rows } = await query(
    `SELECT id, category, question_variants, status, last_verified, notes_for_sales
     FROM dalgo_knowledge_base ORDER BY category, created_at DESC`
  );
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = KbInput.parse(await req.json());
  const text = `${body.question_variants.join(' | ')}\n\n${body.canonical_answer}`;
  const vec = await embed(text);
  const { rows } = await query(
    `INSERT INTO dalgo_knowledge_base
      (category, question_variants, canonical_answer, status, ngo_framing, evidence, notes_for_sales, embedding, last_verified)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::vector, now())
     RETURNING *`,
    [
      body.category,
      body.question_variants,
      body.canonical_answer,
      body.status,
      body.ngo_framing ?? null,
      body.evidence ?? [],
      body.notes_for_sales ?? null,
      vectorLiteral(vec),
    ]
  );
  return NextResponse.json({ item: rows[0] });
}
