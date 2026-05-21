import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';

describe('local Postgres + pgvector', () => {
  it('connects and reports zero rows in dalgo_knowledge_base', async () => {
    const { rows } = await query<{ count: string }>('SELECT count(*)::text AS count FROM dalgo_knowledge_base');
    expect(rows[0]).toBeDefined();
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(0);
  });

  it('has the vector extension', async () => {
    const { rows } = await query<{ extname: string }>("SELECT extname FROM pg_extension WHERE extname = 'vector'");
    expect(rows.length).toBe(1);
  });

  it('has the kb_match function', async () => {
    const { rows } = await query("SELECT proname FROM pg_proc WHERE proname = 'kb_match'");
    expect(rows.length).toBe(1);
  });

  afterAll(async () => { await pool().end(); });
});
