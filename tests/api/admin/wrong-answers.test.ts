import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';

// vi.mock is hoisted by Vitest above all imports — visual order in source does not matter.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => ({ user: { email: 'test@dalgo.org' } })),
}));

import { POST as createPost } from '@/app/api/admin/wrong-answers/route';
import { PATCH as updatePatch } from '@/app/api/admin/wrong-answers/[id]/route';

function req(url: string, init?: RequestInit): any {
  return new Request(url, init);
}

let sessionId: string;

describe('POST /api/admin/wrong-answers', () => {
  let messageId: string;
  let kbId: string;

  beforeAll(async () => {
    const { rows: kb } = await query<{ id: string }>(
      `SELECT id FROM dalgo_knowledge_base LIMIT 1`,
    );
    kbId = kb[0].id;

    const { rows: s } = await query<{ id: string }>(`INSERT INTO sessions DEFAULT VALUES RETURNING id`);
    sessionId = s[0].id;

    const trace = {
      hyde: 'h',
      candidates: { kb: [{ id: kbId, preview: 'p' }], patterns: [], blogs: [] },
      fused_top12: [
        { id: kbId, score: 0.9, source: 'kb_curated', preview: 'top kb candidate' },
        { id: 'fake-pattern-id', score: 0.5, source: 'pattern_curated', preview: 'pat' },
      ],
      rerank_scores: [],
      final_context_ids: [kbId],
    };
    const { rows: m } = await query<{ id: string }>(
      `INSERT INTO messages (session_id, role, content, retrieval_trace)
       VALUES ($1, 'assistant', '{"text":"the bad answer"}'::jsonb, $2::jsonb)
       RETURNING id`,
      [sessionId, JSON.stringify(trace)],
    );
    messageId = m[0].id;
  });

  it('creates a report, snapshots the trace, and returns parsed KB candidates', async () => {
    const res = await createPost(
      req('http://t/api/admin/wrong-answers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, reason: 'fabricated detail' }),
      }) as any,
    );
    const json = await res.json();
    expect(json.id).toBeTruthy();
    expect(Array.isArray(json.candidates)).toBe(true);
    expect(json.candidates.length).toBe(1); // only the kb-source candidate
    expect(json.candidates[0].kb_id).toBe(kbId);
    expect(json.candidates[0].score).toBe(0.9);
    expect(typeof json.candidates[0].question).toBe('string');
    expect(typeof json.candidates[0].snippet).toBe('string');

    const { rows } = await query<{ retrieval_trace_snap: any }>(
      `SELECT retrieval_trace_snap FROM wrong_answer_reports WHERE id = $1`,
      [json.id],
    );
    expect(rows[0].retrieval_trace_snap.fused_top12).toBeTruthy();
  });

  it('handles messages without a trace by returning empty candidates', async () => {
    const { rows: noTrace } = await query<{ id: string }>(
      `INSERT INTO messages (session_id, role, content)
       VALUES ($1, 'assistant', '{"text":"old msg"}'::jsonb) RETURNING id`,
      [sessionId],
    );
    const res = await createPost(
      req('http://t/api/admin/wrong-answers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message_id: noTrace[0].id, reason: 'no trace' }),
      }) as any,
    );
    const json = await res.json();
    expect(json.candidates).toEqual([]);
  });

  it('persists suggested_answer when provided', async () => {
    const res = await createPost(
      req('http://t/api/admin/wrong-answers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, reason: 'wrong detail', suggested_answer: 'should say Z' }),
      }) as any,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBeTruthy();
    const { rows } = await query<{ suggested_answer: string }>(
      `SELECT suggested_answer FROM wrong_answer_reports WHERE id = $1`,
      [json.id],
    );
    expect(rows[0].suggested_answer).toBe('should say Z');
  });
});

describe('PATCH /api/admin/wrong-answers/[id]', () => {
  it('sets fixed_kb_id', async () => {
    const { rows: report } = await query<{ id: string }>(
      `SELECT id FROM wrong_answer_reports ORDER BY reported_at DESC LIMIT 1`,
    );
    const { rows: kb } = await query<{ id: string }>(
      `SELECT id FROM dalgo_knowledge_base LIMIT 1`,
    );
    const res = await updatePatch(
      req(`http://t/api/admin/wrong-answers/${report[0].id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fixed_kb_id: kb[0].id }),
      }) as any,
      { params: Promise.resolve({ id: report[0].id }) },
    );
    expect(res.status).toBe(200);
    const { rows } = await query<{ fixed_kb_id: string }>(
      `SELECT fixed_kb_id FROM wrong_answer_reports WHERE id = $1`,
      [report[0].id],
    );
    expect(rows[0].fixed_kb_id).toBe(kb[0].id);
  });
});

afterAll(async () => {
  await query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
  await pool().end();
});
