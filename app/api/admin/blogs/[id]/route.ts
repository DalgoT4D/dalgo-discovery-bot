import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const { rows: arows } = await query(`SELECT * FROM dalgo_blog_articles WHERE id = $1`, [id]);
  if (arows.length === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const { rows: crows } = await query(
    `SELECT chunk_index, chunk_text, contextual_text
       FROM dalgo_blog_chunks
      WHERE article_id = $1
   ORDER BY chunk_index`,
    [id],
  );
  return NextResponse.json({ article: arows[0], chunks: crows });
}
