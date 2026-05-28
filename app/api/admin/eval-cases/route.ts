import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listEvalCases, createEvalCase } from '@/lib/db/queries/eval-cases';
import { invalidateEvalCaseCache } from '@/lib/llm/eval/case-source';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const bucket = url.searchParams.get('bucket') ?? undefined;
  const enabledOnly = url.searchParams.get('enabledOnly') === 'true';
  const cases = await listEvalCases({ bucket, enabledOnly });
  return NextResponse.json({ cases });
}

interface CreateBody {
  case_key?: unknown;
  bucket?: unknown;
  input?: unknown;
  expected?: unknown;
  judges?: unknown;
  enabled?: unknown;
  notes?: unknown;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (typeof body.case_key !== 'string' || !body.case_key.length)
    return NextResponse.json({ error: 'case_key required' }, { status: 400 });
  if (typeof body.bucket !== 'string' || !body.bucket.length)
    return NextResponse.json({ error: 'bucket required' }, { status: 400 });
  if (typeof body.input !== 'string' || !body.input.length)
    return NextResponse.json({ error: 'input required' }, { status: 400 });
  if (!Array.isArray(body.judges) || body.judges.length === 0)
    return NextResponse.json({ error: 'judges must be a non-empty array' }, { status: 400 });

  const expected = body.expected && typeof body.expected === 'object'
    ? (body.expected as Record<string, unknown>)
    : {};

  const id = await createEvalCase({
    case_key: body.case_key,
    bucket: body.bucket,
    input: body.input,
    expected,
    judges: body.judges as string[],
    enabled: body.enabled !== false,
    notes: typeof body.notes === 'string' ? body.notes : null,
    updated_by: session.user.email ?? 'admin',
  });

  invalidateEvalCaseCache(body.bucket);
  return NextResponse.json({ id }, { status: 201 });
}
