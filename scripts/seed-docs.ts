// scripts/seed-docs.ts — incremental ingest of the product docs site
import 'dotenv/config';
import { runDocsIngest } from '@/lib/docs/ingest';
import { pool } from '@/lib/db/client';

async function main() {
  const sitemapUrl = process.env.DOCS_SITEMAP_URL ?? undefined;
  console.log(`[seed-docs] starting ingest${sitemapUrl ? ` (${sitemapUrl})` : ''}`);

  const summary = await runDocsIngest({
    sitemapUrl,
    onProgress: (s) => {
      process.stdout.write(
        `\r[seed-docs] seen ${s.pagesSeen} · new ${s.pagesNew} · updated ${s.pagesUpdated} · skipped ${s.pagesSkipped}    `,
      );
    },
  });

  console.log('\n[seed-docs] done:', summary);
  await pool().end();
}

main().catch(async (e) => {
  console.error('[seed-docs] fatal:', e);
  await pool().end();
  process.exit(1);
});
