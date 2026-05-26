import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { pool, query } from '@/lib/db/client';
import { invalidatePromptCache } from '@/lib/llm/prompts';
import { z } from 'zod';

const PutBody = z.object({ content: z.string().min(1) });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { key } = await params;

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

  let body: { content: string };
  try {
    body = PutBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'invalid body', detail: String(e) }, { status: 400 });
  }

  const email = session.user.email ?? 'unknown';

  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query<{
      key: string;
      content: string;
      updated_by: string;
      updated_at: string;
    }>(
      `UPDATE dalgo_prompts
          SET content = $1, updated_by = $2, updated_at = now()
        WHERE key = $3
        RETURNING key, content, updated_by, updated_at`,
      [body.content, email, key],
    );
    if (!upd.rows[0]) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    await client.query(
      `INSERT INTO dalgo_prompt_versions (prompt_key, content, updated_by, updated_at)
       VALUES ($1, $2, $3, $4)`,
      [key, upd.rows[0].content, upd.rows[0].updated_by, upd.rows[0].updated_at],
    );
    await client.query('COMMIT');
    invalidatePromptCache(key);
    return NextResponse.json({ item: upd.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
