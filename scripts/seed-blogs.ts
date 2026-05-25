// scripts/seed-blogs.ts
import 'dotenv/config';
import { runIngest } from '@/lib/blogs/ingest';
import { pool } from '@/lib/db/client';

async function main() {
  const categories = (process.env.BLOG_CATEGORIES ?? 'dalgo,data-catalyst-program')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  console.log(`[seed-blogs] starting ingest for categories: ${categories.join(', ')}`);
  const result = await runIngest({
    categories,
    onProgress: async (s) => {
      process.stdout.write(
        `\r[seed-blogs] seen ${s.postsSeen} · new ${s.postsNew} · updated ${s.postsUpdated} · skipped ${s.postsSkipped}    `,
      );
    },
  });
  console.log('\n[seed-blogs] done:', result);
  await pool().end();
}

main().catch(async (e) => {
  console.error('[seed-blogs] fatal:', e);
  await pool().end().catch(() => {});
  process.exit(1);
});
