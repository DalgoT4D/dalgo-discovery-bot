import { query } from '../client';

export type LeadIntent = 'demo' | 'pdf_report' | 'flag_questions' | 'email_signup';

export interface LeadRow {
  id: string;
  session_id: string | null;
  email: string;
  intent: LeadIntent;
  summary: string | null;
  created_at: string;
}

export async function insertLead(args: {
  sessionId: string;
  email: string;
  intent: LeadIntent;
  summary?: string;
}): Promise<LeadRow> {
  const { rows } = await query<LeadRow>(
    `INSERT INTO leads (session_id, email, intent, summary)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [args.sessionId, args.email, args.intent, args.summary ?? null],
  );
  return rows[0];
}

/**
 * Legacy positional wrapper around insertLead. Kept so existing callers
 * (e.g. `/api/lead`) don't have to change shape.
 */
export async function createLead(
  sessionId: string,
  email: string,
  intent: LeadIntent,
  summary?: string,
): Promise<LeadRow> {
  return insertLead({ sessionId, email, intent, summary });
}
