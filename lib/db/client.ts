import { Pool, PoolClient } from 'pg';

let _pool: Pool | null = null;

export function pool(): Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. Configure it in .env.local.');
    }
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }
  return _pool;
}

export async function query<T = any>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
  const p = pool();
  const result = await p.query(sql, params);
  return { rows: result.rows as T[] };
}

export async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const p = pool();
  const c = await p.connect();
  try { return await fn(c); }
  finally { c.release(); }
}
