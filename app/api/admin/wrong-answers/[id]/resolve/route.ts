import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, withClient } from '@/lib/db/client';
import { embed } from '@/lib/embeddings';
import { insertKbEntryTx, versionAndUpdateKbTx } from '@/lib/db/queries/kb';
import { runPipeline } from '@/lib/llm/rag/pipeline';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Draft = z.object({
  category: z.string(),
  question_variants: z.array(z.string().min(1)).min(1),
  canonical_answer: z.string().min(1),
  status: z.enum(['yes', 'partial', 'no', 'roadmap']),
  ngo_framing: z.string().nullable().optional(),
  evidence: z.array(z.string()).optional(),
  notes_for_sales: z.string().nullable().optional(),
});
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('dismiss') }),
  z.object({ action: z.literal('create'), draft: Draft, add_eval_case: z.boolean().default(true) }),
  z.object({ action: z.literal('edit'), target_kb_id: z.string().uuid(), draft: Draft, add_eval_case: z.boolean().default(true) }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const email = session.user.email ?? 'admin';
  const { id } = await params;

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: 'invalid body', detail: String(e) }, { status: 400 }); }

  const rep = await query<{ message_id: string; session_id: string }>(
    `SELECT w.message_id, m.session_id FROM wrong_answer_reports w JOIN messages m ON m.id=w.message_id WHERE w.id=$1`,
    [id]);
  if (!rep.rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (body.action === 'dismiss') {
    await query(`UPDATE wrong_answer_reports SET status='dismissed', resolved_by=$1, resolved_at=now() WHERE id=$2`, [email, id]);
    return NextResponse.json({ ok: true, status: 'dismissed' });
  }

  const qrow = await query<{ text: string }>(
    `SELECT (content->>'text') AS text FROM messages
      WHERE session_id=$1 AND role='user' AND created_at < (SELECT created_at FROM messages WHERE id=$2)
      ORDER BY created_at DESC LIMIT 1`, [rep.rows[0].session_id, rep.rows[0].message_id]);
  const question = qrow.rows[0]?.text ?? body.draft.question_variants[0];

  // Embed BEFORE opening the transaction — don't hold a connection open across a network call
  const vec = await embed(`${body.draft.question_variants.join(' | ')}\n\n${body.draft.canonical_answer}`);
  const vecLit = `[${vec.join(',')}]`;

  const fixedKbId = await withClient<string>(async (client) => {
    await client.query('BEGIN');
    try {
      let kbId: string;
      if (body.action === 'create') {
        kbId = await insertKbEntryTx(client, {
          category: body.draft.category,
          question_variants: body.draft.question_variants,
          canonical_answer: body.draft.canonical_answer,
          status: body.draft.status,
          ngo_framing: body.draft.ngo_framing ?? null,
          evidence: body.draft.evidence ?? [],
          notes_for_sales: body.draft.notes_for_sales ?? null,
          embeddingLiteral: vecLit,
          source: 'wrong_answer_fix',
          source_message_id: rep.rows[0].message_id,
          author_email: email,
        });
      } else {
        kbId = body.target_kb_id;
        await versionAndUpdateKbTx(client, kbId, {
          question_variants: body.draft.question_variants,
          canonical_answer: body.draft.canonical_answer,
          status: body.draft.status,
          ngo_framing: body.draft.ngo_framing,
          evidence: body.draft.evidence,
          notes_for_sales: body.draft.notes_for_sales,
        }, email, vecLit);
      }

      if (body.add_eval_case) {
        await client.query(
          `INSERT INTO dalgo_eval_cases (case_key, bucket, input, expected, judges, enabled, notes, updated_by)
           VALUES ($1,$2,$3,$4::jsonb,$5,true,$6,$7)
           ON CONFLICT (case_key) DO UPDATE SET input=EXCLUDED.input, expected=EXCLUDED.expected, updated_by=EXCLUDED.updated_by, updated_at=now()`,
          [
            `wrong-answer-fix-${id}`,
            'wrong_answer_fix',
            question,
            JSON.stringify({ answer_must_convey: body.draft.canonical_answer.slice(0, 300) }),
            ['llm-judge'],
            `Auto-created from wrong-answer report ${id}`,
            email,
          ]);
      }

      await client.query(
        `UPDATE wrong_answer_reports
            SET status='resolved', fixed_kb_id=$1, fix_kind=$2, resolved_by=$3, resolved_at=now()
          WHERE id=$4`,
        [kbId, body.action === 'create' ? 'created' : 'edited', email, id]);

      await client.query('COMMIT');
      return kbId;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* original error is more useful */ }
      throw err;
    }
  });

  let verified = false;
  try {
    const pr = await runPipeline(question);
    verified = pr.topPassages.some((p) => p.id === fixedKbId);
  } catch { /* verification is best-effort */ }

  return NextResponse.json({ ok: true, status: 'resolved', fixed_kb_id: fixedKbId, verified, question });
}
