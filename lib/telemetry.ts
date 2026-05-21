import { query } from './db/client';

export type EventName =
  | 'session_started'
  | 'intake_completed'
  | 'message_sent'
  | 'kb_hit'
  | 'kb_miss'
  | 'tool_call'
  | 'lead_captured'
  | 'report_generated'
  | 'feedback_given';

export async function emit(
  name: EventName,
  fields: Record<string, unknown>,
  sessionId?: string,
) {
  try {
    await query(
      `INSERT INTO telemetry_events (session_id, event_name, fields)
       VALUES ($1, $2, $3::jsonb)`,
      [sessionId ?? null, name, JSON.stringify(fields)],
    );
  } catch (e) {
    console.error('telemetry emit failed', e);
  }
}
