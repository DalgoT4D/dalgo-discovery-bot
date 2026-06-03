import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';
import { z } from 'zod';
import type { Candidate } from '@/lib/admin/wrong-answer-types';

const CreateBody = z.object({
  message_id: z.string().uuid(),
  reason: z.string().min(1),
  suggested_answer: z.string().optional(),
});

type Trace = {
  fused_top12?: Array<{ id: string; score: number; source: string; preview?: string }>;
};

async function parseCandidates(trace: Trace | null): Promise<Candidate[]> {
  if (!trace?.fused_top12) return [];
  const kbCandidates = trace.fused_top12.filter((c) => c.source === 'kb_curated').slice(0, 5);
  if (kbCandidates.length === 0) return [];
  const ids = kbCandidates.map((c) => c.id);
  try {
    const { rows } = await query<{ id: string; question_variants: string[]; canonical_answer: string }>(
      `SELECT id, question_variants, canonical_answer
         FROM dalgo_knowledge_base
        WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    return kbCandidates
      .map((c) => {
        const row = byId.get(c.id);
        if (!row) return null;
        return {
          kb_id: c.id,
          question: row.question_variants?.[0] ?? '(no question variant)',
          snippet: (row.canonical_answer ?? '').slice(0, 140),
          score: c.score,
        };
      })
      .filter((x): x is Candidate => x !== null);
  } catch (e) {
    console.error('[wrong-answers] parseCandidates query failed', e);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const status = new URL(req.url).searchParams.get('status'); // pending | resolved | dismissed | null(all)
  const params: unknown[] = [];
  let where = '';
  if (status && ['pending', 'resolved', 'dismissed'].includes(status)) {
    params.push(status);
    where = `WHERE w.status = $1`;
  }

  const { rows } = await query(
    `SELECT w.id, w.message_id, w.reason, w.suggested_answer, w.status, w.fix_kind,
            w.fixed_kb_id, w.reported_by, w.reported_at, w.resolved_by, w.resolved_at,
            m.session_id,
            (m.content->>'text') AS answer_text
       FROM wrong_answer_reports w
       JOIN messages m ON m.id = w.message_id
       ${where}
      ORDER BY (w.status = 'pending') DESC, w.reported_at DESC`,
    params,
  );
  return NextResponse.json({ reports: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { message_id: string; reason: string; suggested_answer?: string };
  try {
    body = CreateBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'invalid body', detail: String(e) }, { status: 400 });
  }

  const { rows: msg } = await query<{ retrieval_trace: Trace | null }>(
    `SELECT retrieval_trace FROM messages WHERE id = $1`,
    [body.message_id],
  );
  if (!msg[0]) return NextResponse.json({ error: 'message not found' }, { status: 404 });

  const trace = msg[0].retrieval_trace;
  const email = session.user.email ?? 'unknown';
  const { rows } = await query<{ id: string }>(
    `INSERT INTO wrong_answer_reports
       (message_id, reason, suggested_answer, retrieval_trace_snap, reported_by)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING id`,
    [body.message_id, body.reason, body.suggested_answer ?? null, trace ? JSON.stringify(trace) : null, email],
  );

  const candidates = await parseCandidates(trace);
  return NextResponse.json({ id: rows[0].id, candidates });
}
