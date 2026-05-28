import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getEvalCase, updateEvalCase, deleteEvalCase,
} from '@/lib/db/queries/eval-cases';
import { invalidateEvalCaseCache } from '@/lib/llm/eval/case-source';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VALID_JUDGES = ['retrieval-judge', 'llm-judge', 'exact-match'] as const;

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const row = await getEvalCase(id);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ case: row });
}

interface PutBody {
  input?: unknown;
  bucket?: unknown;
  expected?: unknown;
  judges?: unknown;
  enabled?: unknown;
  notes?: unknown;
}

export async function PUT(req: Request, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await getEvalCase(id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let body: PutBody;
  try { body = (await req.json()) as PutBody; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  // Validate judges if provided
  if (body.judges !== undefined) {
    if (!Array.isArray(body.judges) || body.judges.length === 0) {
      return NextResponse.json({ error: 'judges must be a non-empty array' }, { status: 400 });
    }
    const invalid = (body.judges as unknown[]).filter(
      (j) => typeof j !== 'string' || !VALID_JUDGES.includes(j as typeof VALID_JUDGES[number]),
    );
    if (invalid.length) {
      return NextResponse.json(
        { error: `unknown judge(s): ${invalid.join(', ')}. Allowed: ${VALID_JUDGES.join(', ')}` },
        { status: 400 },
      );
    }
  }

  await updateEvalCase(id, {
    input: typeof body.input === 'string' ? body.input : undefined,
    bucket: typeof body.bucket === 'string' ? body.bucket : undefined,
    expected: body.expected && typeof body.expected === 'object' && !Array.isArray(body.expected)
      ? (body.expected as Record<string, unknown>)
      : undefined,
    judges: Array.isArray(body.judges) ? (body.judges as string[]) : undefined,
    enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    notes: typeof body.notes === 'string' || body.notes === null ? (body.notes as string | null) : undefined,
    updated_by: session.user.email ?? 'admin',
  });
  invalidateEvalCaseCache(existing.bucket);
  if (typeof body.bucket === 'string' && body.bucket !== existing.bucket) {
    invalidateEvalCaseCache(body.bucket);
  }
  const updated = await getEvalCase(id);
  return NextResponse.json({ case: updated });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await getEvalCase(id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await deleteEvalCase(id);
  invalidateEvalCaseCache(existing.bucket);
  return new NextResponse(null, { status: 204 });
}
