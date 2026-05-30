import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, withClient } from '@/lib/db/client';
import { invalidatePromptCache } from '@/lib/llm/prompts';
import { buildToolsInventory } from '@/lib/llm/tools-inventory';
import { z } from 'zod';

const READ_ONLY_KEYS = new Set(['tools_inventory']);

type PromptRow = {
  key: string;
  content: string;
  updated_by: string;
  updated_at: string;
};

const PutBody = z.object({ content: z.string().min(1) });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { key } = await params;

  if (key === 'tools_inventory') {
    return NextResponse.json({
      item: {
        key,
        content: buildToolsInventory(),
        updated_by: 'auto-generated from lib/llm/tools/',
        updated_at: new Date(0).toISOString(),
        read_only: true,
      },
    });
  }

  const { rows } = await query(
    `SELECT key, content, updated_by, updated_at FROM dalgo_prompts WHERE key = $1`,
    [key],
  );
  if (!rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ item: rows[0] });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { key } = await params;

  if (READ_ONLY_KEYS.has(key)) {
    return NextResponse.json(
      { error: 'read-only', detail: `'${key}' is auto-generated and cannot be edited` },
      { status: 403 },
    );
  }

  let body: { content: string };
  try {
    body = PutBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'invalid body', detail: String(e) }, { status: 400 });
  }

  const email = session.user.email ?? 'unknown';

  const updated = await withClient<PromptRow | null>(async (client) => {
    try {
      await client.query('BEGIN');
      const upd = await client.query<PromptRow>(
        `UPDATE dalgo_prompts
            SET content = $1, updated_by = $2, updated_at = now()
          WHERE key = $3
          RETURNING key, content, updated_by, updated_at`,
        [body.content, email, key],
      );
      if (!upd.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query(
        `INSERT INTO dalgo_prompt_versions (prompt_key, content, updated_by, updated_at)
         VALUES ($1, $2, $3, $4)`,
        [key, upd.rows[0].content, upd.rows[0].updated_by, upd.rows[0].updated_at],
      );
      await client.query('COMMIT');
      return upd.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  });

  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });
  invalidatePromptCache(key);
  return NextResponse.json({ item: updated });
}
