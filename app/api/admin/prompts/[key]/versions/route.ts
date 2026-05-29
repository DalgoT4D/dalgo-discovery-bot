import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { key } = await params;

  const { rows } = await query(
    `SELECT id, prompt_key, content, updated_by, updated_at
       FROM dalgo_prompt_versions
      WHERE prompt_key = $1
      ORDER BY updated_at DESC`,
    [key],
  );
  return NextResponse.json({ versions: rows });
}
