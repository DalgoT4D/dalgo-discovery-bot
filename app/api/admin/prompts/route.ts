import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';
import { buildToolsInventory } from '@/lib/llm/tools-inventory';

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
  const items = rows.map((r) =>
    r.key === 'tools_inventory'
      ? {
          ...r,
          content: buildToolsInventory(),
          updated_by: 'auto-generated from lib/llm/tools/',
          read_only: true,
        }
      : r,
  );
  return NextResponse.json({ items });
}
