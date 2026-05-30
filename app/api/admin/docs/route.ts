import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { rows } = await query(
    `SELECT p.id, p.url, p.title, p.last_fetched_at,
            (SELECT COUNT(*) FROM dalgo_doc_chunks c WHERE c.page_id = p.id) AS chunk_count
       FROM dalgo_doc_pages p
   ORDER BY p.last_fetched_at DESC`,
  );
  return NextResponse.json({ items: rows });
}
