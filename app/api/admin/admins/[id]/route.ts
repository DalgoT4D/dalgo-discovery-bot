import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';
import { deleteAdmin } from '@/lib/db/queries/admins';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !(session.user as { isSystem?: boolean }).isSystem) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const callerId = (session.user as { id: string }).id;
  if (id === callerId) {
    return NextResponse.json({ error: 'cannot_remove_self' }, { status: 400 });
  }
  const { rows } = await query<{ is_system: boolean }>(
    `SELECT is_system FROM admins WHERE id = $1`,
    [id],
  );
  if (!rows[0]) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (rows[0].is_system) {
    return NextResponse.json({ error: 'cannot_remove_system' }, { status: 400 });
  }
  await deleteAdmin(id);
  return NextResponse.json({ ok: true });
}
