import { query } from '../client';

export interface MessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: unknown;
  token_count: number | null;
  created_at: string;
}

export async function listMessages(sessionId: string): Promise<MessageRow[]> {
  const { rows } = await query<MessageRow>(
    'SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at',
    [sessionId],
  );
  return rows;
}

export async function appendMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'tool',
  content: unknown,
  tokenCount?: number,
  id?: string,
): Promise<MessageRow> {
  // When an explicit id is given (the assistant message id streamed to the
  // client, so it matches what the UI reports for wrong-answers), use it;
  // otherwise fall back to a DB-generated UUID.
  const { rows } = await query<MessageRow>(
    `INSERT INTO messages (id, session_id, role, content, token_count)
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4::jsonb, $5)
     RETURNING *`,
    [id ?? null, sessionId, role, JSON.stringify(content), tokenCount ?? null],
  );
  return rows[0];
}
