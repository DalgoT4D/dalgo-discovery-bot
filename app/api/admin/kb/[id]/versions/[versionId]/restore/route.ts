import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { withClient } from '@/lib/db/client';
import { embed } from '@/lib/embeddings';
import { getKbVersion } from '@/lib/db/queries/kb-versions';

interface Ctx { params: Promise<{ id: string; versionId: string }>; }

export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id, versionId } = await ctx.params;
  const updatedBy = session.user.email ?? 'admin';

  const version = await getKbVersion(Number(versionId));
  if (!version) return NextResponse.json({ error: 'version not found' }, { status: 404 });
  if (version.kb_id !== id) return NextResponse.json({ error: 'version belongs to different KB entry' }, { status: 400 });

  const fullText = `${version.question_variants.join(' | ')}\n${version.canonical_answer}`;
  const embedding = await embed(fullText);

  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      // Snapshot CURRENT state before overwriting (so we can re-restore later)
      const cur = await client.query<{
        category: string; question_variants: string[]; canonical_answer: string;
        status: string | null; ngo_framing: string | null; evidence: string[] | null;
        notes_for_sales: string | null;
      }>(
        `SELECT category, question_variants, canonical_answer, status,
                ngo_framing, evidence, notes_for_sales
           FROM dalgo_knowledge_base WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (cur.rows.length === 0) throw new Error('not found');
      const prev = cur.rows[0];

      await client.query(
        `INSERT INTO dalgo_kb_versions
           (kb_id, category, question_variants, canonical_answer, status,
            ngo_framing, evidence, notes_for_sales, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          id, prev.category, prev.question_variants, prev.canonical_answer,
          prev.status, prev.ngo_framing, prev.evidence ?? [], prev.notes_for_sales,
          updatedBy,
        ],
      );

      // Restore the chosen version onto the current row
      await client.query(
        `UPDATE dalgo_knowledge_base
            SET category = $2, question_variants = $3, canonical_answer = $4,
                status = $5, ngo_framing = $6, evidence = $7,
                notes_for_sales = $8, embedding = $9::vector,
                updated_at = NOW(), author_email = $10
          WHERE id = $1`,
        [
          id, version.category, version.question_variants, version.canonical_answer,
          version.status, version.ngo_framing, version.evidence, version.notes_for_sales,
          `[${embedding.join(',')}]`, updatedBy,
        ],
      );
      await client.query('COMMIT');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
  });

  return NextResponse.json({ ok: true });
}
