import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { GET, POST } from '@/app/api/admin/eval-cases/route';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com', isSystem: false } }),
}));

describe('GET /api/admin/eval-cases', () => {
  beforeEach(async () => {
    await query(`DELETE FROM dalgo_eval_cases WHERE case_key LIKE 'api_%'`);
  });

  it('returns list of cases', async () => {
    await query(
      `INSERT INTO dalgo_eval_cases (case_key, bucket, input, expected, judges, updated_by)
       VALUES ('api_one', 'citations', 'x', '{}', ARRAY['retrieval-judge'], 'seed')`,
    );
    const req = new Request('http://localhost/api/admin/eval-cases');
    const res = await GET(req as unknown as Request);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.cases)).toBe(true);
    expect(body.cases.some((c: { case_key: string }) => c.case_key === 'api_one')).toBe(true);
  });

  it('supports bucket filter via ?bucket=', async () => {
    await query(
      `INSERT INTO dalgo_eval_cases (case_key, bucket, input, expected, judges, updated_by)
       VALUES ('api_filter', 'guardrails', 'x', '{}', ARRAY['llm-judge'], 'seed')`,
    );
    const req = new Request('http://localhost/api/admin/eval-cases?bucket=guardrails');
    const res = await GET(req as unknown as Request);
    const body = await res.json();
    expect(body.cases.every((c: { bucket: string }) => c.bucket === 'guardrails')).toBe(true);
  });

  it('POST creates a new case', async () => {
    const req = new Request('http://localhost/api/admin/eval-cases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        case_key: 'api_created',
        bucket: 'guardrails',
        input: 'test input',
        expected: { must_express_uncertainty: true },
        judges: ['llm-judge'],
        enabled: true,
        notes: null,
      }),
    });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('POST rejects missing required fields', async () => {
    const req = new Request('http://localhost/api/admin/eval-cases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ case_key: 'incomplete' }),
    });
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(400);
  });

  afterAll(async () => { await pool().end(); });
});
