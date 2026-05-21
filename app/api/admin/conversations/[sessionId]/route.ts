import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { listMessages } from '@/lib/db/queries/messages';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { sessionId } = await params;
  const messages = await listMessages(sessionId);
  return NextResponse.json({ messages });
}
