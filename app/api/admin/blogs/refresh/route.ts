import { NextResponse, after } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';
import { runIngest } from '@/lib/blogs/ingest';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { rows } = await query<{ id: string }>(
    `INSERT INTO blog_refresh_jobs (status) VALUES ('running') RETURNING id`,
  );
  const jobId = rows[0].id;

  // Run after the response is sent. after() keeps the work alive within maxDuration
  // on Vercel (a bare `void` promise would be killed once the function returns).
  // The job updates blog_refresh_jobs as it progresses; the UI polls for status.
  // Incremental refresh only processes new posts, so it stays well under 300s — a
  // full reseed is the local `npm run seed:kb:reset` CLI, not this route.
  after(async () => {
    try {
      await runIngest({
        categories: (process.env.BLOG_CATEGORIES ?? 'dalgo,data-catalyst-program').split(','),
        jobId,
      });
    } catch (e) {
      console.error('[refresh] background ingest failed:', e);
    }
  });

  return NextResponse.json({ jobId });
}
