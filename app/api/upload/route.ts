import { NextRequest, NextResponse } from 'next/server';
import { extractPdfText } from '@/lib/pdf';
import { updateSession } from '@/lib/db/queries/sessions';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const session_id = form.get('session_id') as string | null;
  const file = form.get('file') as File | null;
  if (!session_id || !file) return NextResponse.json({ error: 'missing fields' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const text = await extractPdfText(buf);
  await updateSession(session_id, { pdf_text: text });
  return NextResponse.json({ ok: true });
}
