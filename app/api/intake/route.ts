import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession, updateSession } from '@/lib/db/queries/sessions';
import { fetchAndSummarizeNgoWebsite } from '@/lib/tavily';
import { emit } from '@/lib/telemetry';

const IntakeBody = z.object({
  ngo_url: z.string().url().optional(),
  ngo_systems: z.string().optional(),
  data_types: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const body = IntakeBody.parse(await req.json());
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const session = await createSession({ ip, ...body });

  await emit('session_started', { ngo_url: body.ngo_url ?? null, has_pdf: false }, session.id);

  if (body.ngo_url) {
    (async () => {
      try {
        const summary = await fetchAndSummarizeNgoWebsite(body.ngo_url!);
        if (summary) {
          await updateSession(session.id, { ngo_summary: summary });
          await emit('intake_completed', { crawl_success: true }, session.id);
        } else {
          await emit('intake_completed', { crawl_success: false }, session.id);
        }
      } catch (e) {
        console.error('crawl failed', e);
        await emit('intake_completed', { crawl_success: false }, session.id);
      }
    })();
  }
  return NextResponse.json({ session_id: session.id });
}
