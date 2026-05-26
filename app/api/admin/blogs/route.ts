import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { rows } = await query(
    `SELECT a.id, a.url, a.title, a.category, a.published_at, a.last_fetched_at,
            (SELECT COUNT(*) FROM dalgo_blog_chunks c WHERE c.article_id = a.id) AS chunk_count
       FROM dalgo_blog_articles a
   ORDER BY a.last_fetched_at DESC`,
  );
  return NextResponse.json({ items: rows });
}
