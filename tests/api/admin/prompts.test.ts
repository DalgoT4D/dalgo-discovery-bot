import { describe, it, expect, afterAll, afterEach, vi, beforeEach } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';

// vi.mock is hoisted by Vitest above all imports — visual order in source does not matter.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => ({ user: { email: 'test@dalgo.org' } })),
}));

import { GET as listGet } from '@/app/api/admin/prompts/route';
import { GET as oneGet, PUT as onePut } from '@/app/api/admin/prompts/[key]/route';
import { GET as versionsGet } from '@/app/api/admin/prompts/[key]/versions/route';

function req(url: string, init?: RequestInit): any {
  return new Request(url, init);
}

describe('GET /api/admin/prompts', () => {
  it('returns all 6 prompts', async () => {
    const res = await listGet(req('http://t/api/admin/prompts') as any);
    const json = await res.json();
    expect(json.items.length).toBe(6);
    expect(json.items[0]).toHaveProperty('key');
    expect(json.items[0]).toHaveProperty('content');
    expect(json.items[0]).toHaveProperty('updated_at');
  });
});

describe('GET /api/admin/prompts/[key]', () => {
  it('returns one prompt', async () => {
    const res = await oneGet(req('http://t/api/admin/prompts/identity') as any, {
      params: Promise.resolve({ key: 'identity' }),
    });
    const json = await res.json();
    expect(json.item.key).toBe('identity');
    expect(json.item.content).toContain('Dalgo Discovery Assistant');
  });

  it('returns 404 for unknown key', async () => {
    const res = await oneGet(req('http://t/api/admin/prompts/nope') as any, {
      params: Promise.resolve({ key: 'nope' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns auto-generated content for tools_inventory with read_only=true', async () => {
    const res = await oneGet(req('http://t/api/admin/prompts/tools_inventory') as any, {
      params: Promise.resolve({ key: 'tools_inventory' }),
    });
    const json = await res.json();
    expect(json.item.key).toBe('tools_inventory');
    expect(json.item.read_only).toBe(true);
    expect(json.item.content).toContain('search_dalgo_kb');
  });
});

describe('PUT /api/admin/prompts/[key]', () => {
  let originalContent: string;

  beforeEach(async () => {
    const { rows } = await query<{ content: string }>(
      `SELECT content FROM dalgo_prompts WHERE key = 'identity'`,
    );
    originalContent = rows[0].content;
  });

  afterEach(async () => {
    if (originalContent) {
      await query(
        `UPDATE dalgo_prompts SET content = $1 WHERE key = 'identity'`,
        [originalContent],
      );
    }
  });

  it('updates the prompt AND appends a version row in one transaction', async () => {
    const versionsBefore = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM dalgo_prompt_versions WHERE prompt_key = 'identity'`,
    );

    const res = await onePut(
      req('http://t/api/admin/prompts/identity', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'updated-by-test' }),
      }) as any,
      { params: Promise.resolve({ key: 'identity' }) },
    );
    const json = await res.json();
    expect(json.item.content).toBe('updated-by-test');
    expect(json.item.updated_by).toBe('test@dalgo.org');

    const versionsAfter = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM dalgo_prompt_versions WHERE prompt_key = 'identity'`,
    );
    expect(versionsAfter.rows[0].n).toBe(versionsBefore.rows[0].n + 1);
  });

  it('returns 400 for invalid body', async () => {
    const res = await onePut(
      req('http://t/api/admin/prompts/identity', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wrong_field: 'x' }),
      }) as any,
      { params: Promise.resolve({ key: 'identity' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown key', async () => {
    const res = await onePut(
      req('http://t/api/admin/prompts/nope', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'x' }),
      }) as any,
      { params: Promise.resolve({ key: 'nope' }) },
    );
    expect(res.status).toBe(404);
  });

  it('rejects PUT on tools_inventory with 403 (auto-generated, read-only)', async () => {
    const res = await onePut(
      req('http://t/api/admin/prompts/tools_inventory', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'manual override' }),
      }) as any,
      { params: Promise.resolve({ key: 'tools_inventory' }) },
    );
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/prompts/[key]/versions', () => {
  it('returns history descending by updated_at', async () => {
    const res = await versionsGet(
      req('http://t/api/admin/prompts/identity/versions') as any,
      { params: Promise.resolve({ key: 'identity' }) },
    );
    const json = await res.json();
    expect(Array.isArray(json.versions)).toBe(true);
    expect(json.versions.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < json.versions.length; i++) {
      const prev = new Date(json.versions[i - 1].updated_at).getTime();
      const cur = new Date(json.versions[i].updated_at).getTime();
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });
});

afterAll(async () => { await pool().end(); });
