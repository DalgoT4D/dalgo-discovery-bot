import { query } from '../client';

export interface LeadRow {
  id: string;
  session_id: string | null;
  email: string;
  intent: 'demo' | 'pdf_report' | 'flag_questions';
  summary: string | null;
  created_at: string;
}

export async function createLead(
  sessionId: string,
  email: string,
  intent: 'demo' | 'pdf_report' | 'flag_questions',
  summary?: string,
): Promise<LeadRow> {
  const { rows } = await query<LeadRow>(
    `INSERT INTO leads (session_id, email, intent, summary)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [sessionId, email, intent, summary ?? null],
  );
  return rows[0];
}
