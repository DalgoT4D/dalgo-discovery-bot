import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';
import { runDocsIngest } from '@/lib/docs/ingest';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { rows } = await query<{ id: string }>(
    `INSERT INTO doc_refresh_jobs (status) VALUES ('running') RETURNING id`,
  );
  const jobId = rows[0].id;

  void runDocsIngest({
    sitemapUrl: process.env.DOCS_SITEMAP_URL,
    jobId,
  }).catch((e) => console.error('[docs-refresh] background ingest failed:', e));

  return NextResponse.json({ jobId });
}
