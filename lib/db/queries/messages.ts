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
): Promise<MessageRow> {
  const { rows } = await query<MessageRow>(
    `INSERT INTO messages (session_id, role, content, token_count)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING *`,
    [sessionId, role, JSON.stringify(content), tokenCount ?? null],
  );
  return rows[0];
}
