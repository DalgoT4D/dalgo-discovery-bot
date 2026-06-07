import 'dotenv/config';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '@/lib/db/client';

/**
 * Apply the database schema + every migration, in order, over the existing
 * `pg` pool (no `psql` binary required). Mirrors scripts/db-bootstrap.sh:
 *
 *   1. lib/db/schema.sql            (base schema + CREATE EXTENSION vector)
 *   2. scripts/migrations/*.sql     (alphabetical)
 *   3. lib/db/migrations/*.sql      (alphabetical)
 *   4. lib/db/schema.sql AGAIN      (re-apply to converge the drifted
 *                                    dalgo_knowledge_base category CHECK)
 *
 * Every file is idempotent (IF NOT EXISTS / DROP-then-ADD), so re-running is
 * safe. Run it with the RDS *master* credentials the first time — step 1's
 * CREATE EXTENSION needs a privileged role:
 *
 *   DATABASE_URL='postgres://master:pw@host:5432/db?sslmode=require' \
 *     DATABASE_SSL=true npm run db:migrate
 */

const ROOT = process.cwd();

function sqlFilesIn(dir: string): string[] {
  return readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => join(dir, f));
}

async function run(relPath: string) {
  const sql = readFileSync(join(ROOT, relPath), 'utf8');
  console.log(`  → ${relPath}`);
  // No params → simple query protocol, so multi-statement .sql files run as one.
  await pool().query(sql);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  console.log('== 1/4  base schema ==');
  await run('lib/db/schema.sql');

  console.log('== 2/4  scripts/migrations ==');
  for (const f of sqlFilesIn('scripts/migrations')) await run(f);

  console.log('== 3/4  lib/db/migrations ==');
  for (const f of sqlFilesIn('lib/db/migrations')) await run(f);

  console.log('== 4/4  re-apply schema.sql (converge category CHECK) ==');
  await run('lib/db/schema.sql');

  console.log('✓ Migrations applied.');
  await pool().end();
}

main().catch((err) => {
  console.error('✗ Migration failed:', err);
  process.exit(1);
});
