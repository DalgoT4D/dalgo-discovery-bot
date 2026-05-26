import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { rows } = await query<{
    key: string;
    content: string;
    updated_by: string;
    updated_at: string;
  }>(
    `SELECT key, content, updated_by, updated_at
       FROM dalgo_prompts
       ORDER BY key`,
  );
  return NextResponse.json({ items: rows });
}
