import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';
import { draftKbFix, type DraftCandidate } from '@/lib/llm/draft-kb-fix';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Trace = { fused_top12?: Array<{ id: string; source: string; preview?: string }> };

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  const { rows } = await query<{
    reason: string; suggested_answer: string | null; retrieval_trace_snap: Trace | null;
    answer_text: string; session_id: string; message_id: string;
  }>(
    `SELECT w.reason, w.suggested_answer, w.retrieval_trace_snap,
            (m.content->>'text') AS answer_text, m.session_id, w.message_id
       FROM wrong_answer_reports w JOIN messages m ON m.id = w.message_id
      WHERE w.id = $1`,
    [id],
  );
  if (!rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const rep = rows[0];

  const q = await query<{ text: string }>(
    `SELECT (content->>'text') AS text FROM messages
      WHERE session_id = $1 AND role = 'user'
        AND created_at < (SELECT created_at FROM messages WHERE id = $2)
      ORDER BY created_at DESC LIMIT 1`,
    [rep.session_id, rep.message_id],
  );
  const question = q.rows[0]?.text ?? '';

  const ids = (rep.retrieval_trace_snap?.fused_top12 ?? [])
    .filter((c) => c.source === 'kb_curated').slice(0, 5).map((c) => c.id);
  let candidates: DraftCandidate[] = [];
  if (ids.length) {
    const kb = await query<{ id: string; question_variants: string[]; canonical_answer: string }>(
      `SELECT id, question_variants, canonical_answer FROM dalgo_knowledge_base WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    candidates = kb.rows.map((r) => ({ kb_id: r.id, question: r.question_variants?.[0] ?? '', snippet: (r.canonical_answer ?? '').slice(0, 200) }));
  }

  const draft = await draftKbFix({
    question, wrongAnswer: rep.answer_text, reason: rep.reason,
    suggestedAnswer: rep.suggested_answer ?? undefined, candidates,
  });
  return NextResponse.json({ ...draft, question });
}
