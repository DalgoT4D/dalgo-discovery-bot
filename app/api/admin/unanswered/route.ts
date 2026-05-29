import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { rows } = await query(
    `SELECT id, question, session_id, created_at
       FROM unanswered_questions
      WHERE reviewed = false
   ORDER BY created_at DESC
      LIMIT 200`,
  );
  return NextResponse.json({ items: rows });
}
