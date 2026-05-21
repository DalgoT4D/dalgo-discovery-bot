import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';
import { Resend } from 'resend';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface StaleRow {
  id: string;
  category: string;
  question_variants: string[] | null;
  last_verified: string;
}

interface UnansweredRow {
  question: string;
  created_at: string;
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { rows: stale } = await query<StaleRow>(
    `SELECT id, category, question_variants, last_verified
     FROM dalgo_knowledge_base
     WHERE last_verified < $1
     ORDER BY last_verified`,
    [cutoff],
  );

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { rows: unanswered } = await query<UnansweredRow>(
    `SELECT question, created_at FROM unanswered_questions
     WHERE created_at > $1
     ORDER BY created_at DESC
     LIMIT 30`,
    [weekAgo],
  );

  const recipients = (process.env.ADMIN_DIGEST_RECIPIENTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!process.env.RESEND_API_KEY || recipients.length === 0) {
    return NextResponse.json({
      ok: true,
      stale: stale.length,
      unanswered: unanswered.length,
      note: 'email not sent (RESEND_API_KEY or ADMIN_DIGEST_RECIPIENTS missing)',
    });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = `
    <h2>Dalgo Discovery Bot — Weekly KB Audit</h2>
    <h3>Stale entries (${stale.length})</h3>
    <ul>${stale
      .map(
        (s) =>
          `<li>${s.category}: ${s.question_variants?.[0] ?? ''} (last verified ${new Date(
            s.last_verified,
          ).toLocaleDateString()})</li>`,
      )
      .join('')}</ul>
    <h3>Unanswered questions (last 7 days, ${unanswered.length})</h3>
    <ul>${unanswered.map((u) => `<li>${u.question}</li>`).join('')}</ul>
  `;
  await resend.emails.send({
    from: 'discovery-bot@dalgo.org',
    to: recipients,
    subject: `Discovery Bot KB digest — ${new Date().toLocaleDateString()}`,
    html,
  });

  return NextResponse.json({ ok: true, stale: stale.length, unanswered: unanswered.length });
}
