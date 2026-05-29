import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { insertKbFromMessage } from '@/lib/db/queries/kb';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const id = await insertKbFromMessage({
    questionVariants: body.questionVariants,
    canonicalAnswer: body.canonicalAnswer,
    category: body.category,
    status: body.status,
    evidence: body.evidence ?? [],
    ngoFraming: body.ngoFraming,
    notesForSales: body.notesForSales,
    source: body.source ?? 'promoted_from_conversation',
    sourceMessageId: body.sourceMessageId,
    authorEmail: session.user.email,
  });
  return NextResponse.json({ id });
}
