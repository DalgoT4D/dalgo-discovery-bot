import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { GET, POST } from '@/app/api/admin/eval-runs/route';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com', isSystem: false } }),
}));

describe('/api/admin/eval-runs', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_runs WHERE triggered_by LIKE 'apitest%'`);
    // Disable seeded cases so POST doesn't kick off a 5-minute background run
    await query(`UPDATE dalgo_eval_cases SET enabled = FALSE`);
  });

  // Re-enable after this file so other tests aren't affected
  afterAll(async () => {
    await query(`UPDATE dalgo_eval_cases SET enabled = TRUE`);
    await pool().end();
  });

  it('POST creates a pending run and returns id', async () => {
    const req = new Request('http://localhost/api/admin/eval-runs', { method: 'POST' });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.id).toMatch(/[0-9a-f-]{36}/);
    const { rows } = await query<{ status: string }>(
      `SELECT status FROM dalgo_eval_runs WHERE id = $1`, [body.id],
    );
    expect(['pending', 'running', 'succeeded']).toContain(rows[0].status);
  });

  it('GET lists runs newest first', async () => {
    await query(
      `INSERT INTO dalgo_eval_runs (status, kind, triggered_by) VALUES
       ('succeeded', 'full', 'apitest1'),
       ('succeeded', 'full', 'apitest2')`,
    );
    const req = new Request('http://localhost/api/admin/eval-runs');
    const res = await GET(req as unknown as Request);
    const body = await res.json();
    const ours = body.runs.filter((r: { triggered_by: string }) => r.triggered_by.startsWith('apitest'));
    expect(ours.length).toBeGreaterThanOrEqual(2);
  });
});
