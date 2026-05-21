import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession, updateSession } from '@/lib/db/queries/sessions';
import { fetchAndSummarizeNgoWebsite } from '@/lib/tavily';

const IntakeBody = z.object({
  ngo_url: z.string().url().optional(),
  ngo_systems: z.string().optional(),
  data_types: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const body = IntakeBody.parse(await req.json());
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const session = await createSession({ ip, ...body });

  if (body.ngo_url) {
    (async () => {
      try {
        const summary = await fetchAndSummarizeNgoWebsite(body.ngo_url!);
        if (summary) await updateSession(session.id, { ngo_summary: summary });
      } catch (e) { console.error('crawl failed', e); }
    })();
  }
  return NextResponse.json({ session_id: session.id });
}
