import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { extractQaPairs } from '@/lib/llm/extract-qa';

interface Body {
  text?: unknown;
  category?: unknown;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Body;
  try { body = (await req.json()) as Body; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  if (typeof body.text !== 'string' || body.text.trim().length === 0)
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  const category = typeof body.category === 'string' ? body.category : undefined;

  try {
    const result = await extractQaPairs(body.text, { category });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
