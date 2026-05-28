import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getEvalCase } from '@/lib/db/queries/eval-cases';
import { runSingleCaseNow } from '@/lib/llm/eval/run-service';

interface Ctx { params: Promise<{ id: string }>; }

export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const row = await getEvalCase(id);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  try {
    const result = await runSingleCaseNow(row.case_key, session.user.email ?? 'admin');
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
