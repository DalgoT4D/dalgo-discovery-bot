import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';
import { runIngest } from '@/lib/blogs/ingest';

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { rows } = await query<{ id: string }>(
    `INSERT INTO blog_refresh_jobs (status) VALUES ('running') RETURNING id`,
  );
  const jobId = rows[0].id;

  // Fire-and-forget. The job updates blog_refresh_jobs as it progresses (Phase 1 Task 10).
  void runIngest({
    categories: (process.env.BLOG_CATEGORIES ?? 'dalgo,data-catalyst-program').split(','),
    jobId,
  }).catch((e) => console.error('[refresh] background ingest failed:', e));

  return NextResponse.json({ jobId });
}
