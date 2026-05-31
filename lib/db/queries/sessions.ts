import { query } from '../client';

export interface CreateSessionInput {
  ip?: string;
  ngo_url?: string;
  ngo_systems?: string;
  data_types?: string[];
}

export async function createSession(input: CreateSessionInput) {
  const { rows } = await query(
    `INSERT INTO sessions (ip, ngo_url, ngo_systems, data_types)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.ip ?? null, input.ngo_url ?? null, input.ngo_systems ?? null, input.data_types ?? []],
  );
  return rows[0];
}

export async function updateSession(
  id: string,
  patch: Partial<{
    ngo_summary: string;
    pdf_url: string;
    pdf_text: string;
    ended_at: string;
    work_domain: string;
    wants_followup: boolean;
    triage_status: 'new' | 'approved' | 'rejected';
  }>,
) {
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = keys.map(k => (patch as any)[k]);
  values.push(id);
  await query(`UPDATE sessions SET ${setClause} WHERE id = $${keys.length + 1}`, values);
}

export async function getSession(id: string) {
  const { rows } = await query('SELECT * FROM sessions WHERE id = $1', [id]);
  if (!rows[0]) throw new Error(`session ${id} not found`);
  return rows[0];
}

export async function setWantsFollowup(id: string): Promise<void> {
  await query(`UPDATE sessions SET wants_followup = true WHERE id = $1`, [id]);
}

export async function setTriageStatus(
  id: string,
  status: 'new' | 'approved' | 'rejected',
): Promise<void> {
  await query(`UPDATE sessions SET triage_status = $2 WHERE id = $1`, [id, status]);
}
