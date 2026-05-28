import { query, withClient } from '@/lib/db/client';

export interface EvalCaseRow {
  id: string;
  case_key: string;
  bucket: string;
  input: string;
  expected: Record<string, unknown>;
  judges: string[];
  enabled: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  updated_by: string;
}

export interface EvalCaseInput {
  case_key: string;
  bucket: string;
  input: string;
  expected: Record<string, unknown>;
  judges: string[];
  enabled: boolean;
  notes: string | null;
  updated_by: string;
}

export interface EvalCasePatch {
  input?: string;
  expected?: Record<string, unknown>;
  judges?: string[];
  enabled?: boolean;
  notes?: string | null;
  bucket?: string;
  updated_by: string;
}

export interface EvalCaseVersionRow {
  id: number;
  case_id: string;
  case_key: string;
  bucket: string;
  input: string;
  expected: Record<string, unknown>;
  judges: string[];
  enabled: boolean;
  notes: string | null;
  updated_by: string;
  updated_at: Date;
}

export async function createEvalCase(input: EvalCaseInput): Promise<string> {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO dalgo_eval_cases
           (case_key, bucket, input, expected, judges, enabled, notes, updated_by)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)
         RETURNING id`,
        [input.case_key, input.bucket, input.input, JSON.stringify(input.expected),
         input.judges, input.enabled, input.notes, input.updated_by],
      );
      const id = ins.rows[0].id;
      await client.query(
        `INSERT INTO dalgo_eval_case_versions
           (case_id, case_key, bucket, input, expected, judges, enabled, notes, updated_by)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)`,
        [id, input.case_key, input.bucket, input.input,
         JSON.stringify(input.expected), input.judges, input.enabled,
         input.notes, input.updated_by],
      );
      await client.query('COMMIT');
      return id;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export async function getEvalCase(id: string): Promise<EvalCaseRow | null> {
  const { rows } = await query<EvalCaseRow>(
    `SELECT * FROM dalgo_eval_cases WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getEvalCaseByKey(case_key: string): Promise<EvalCaseRow | null> {
  const { rows } = await query<EvalCaseRow>(
    `SELECT * FROM dalgo_eval_cases WHERE case_key = $1`,
    [case_key],
  );
  return rows[0] ?? null;
}

export interface ListOptions {
  bucket?: string;
  enabledOnly?: boolean;
}

export async function listEvalCases(opts: ListOptions = {}): Promise<EvalCaseRow[]> {
  const wheres: string[] = [];
  const params: unknown[] = [];
  if (opts.bucket) { params.push(opts.bucket); wheres.push(`bucket = $${params.length}`); }
  if (opts.enabledOnly) { wheres.push(`enabled = TRUE`); }
  const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  const { rows } = await query<EvalCaseRow>(
    `SELECT * FROM dalgo_eval_cases ${whereSql} ORDER BY bucket, case_key`,
    params,
  );
  return rows;
}

export async function updateEvalCase(id: string, patch: EvalCasePatch): Promise<void> {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      // Read current row to compose the version snapshot
      const current = await client.query<EvalCaseRow>(
        `SELECT * FROM dalgo_eval_cases WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (current.rows.length === 0) throw new Error(`eval case ${id} not found`);
      const cur = current.rows[0];

      const next = {
        bucket: patch.bucket ?? cur.bucket,
        input: patch.input ?? cur.input,
        expected: patch.expected ?? cur.expected,
        judges: patch.judges ?? cur.judges,
        enabled: patch.enabled ?? cur.enabled,
        notes: patch.notes !== undefined ? patch.notes : cur.notes,
      };

      await client.query(
        `UPDATE dalgo_eval_cases
            SET bucket = $2, input = $3, expected = $4::jsonb,
                judges = $5, enabled = $6, notes = $7,
                updated_by = $8, updated_at = NOW()
          WHERE id = $1`,
        [id, next.bucket, next.input, JSON.stringify(next.expected),
         next.judges, next.enabled, next.notes, patch.updated_by],
      );

      await client.query(
        `INSERT INTO dalgo_eval_case_versions
           (case_id, case_key, bucket, input, expected, judges, enabled, notes, updated_by)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)`,
        [id, cur.case_key, next.bucket, next.input,
         JSON.stringify(next.expected), next.judges, next.enabled,
         next.notes, patch.updated_by],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export async function deleteEvalCase(id: string): Promise<void> {
  await query(`DELETE FROM dalgo_eval_cases WHERE id = $1`, [id]);
}

export async function listEvalCaseVersions(id: string): Promise<EvalCaseVersionRow[]> {
  const { rows } = await query<EvalCaseVersionRow>(
    `SELECT * FROM dalgo_eval_case_versions
      WHERE case_id = $1
      ORDER BY updated_at DESC`,
    [id],
  );
  return rows;
}
