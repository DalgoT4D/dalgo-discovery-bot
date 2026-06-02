import { Pool, PoolClient } from 'pg';

let _pool: Pool | null = null;

/**
 * Connections each container holds. Total load on RDS is roughly
 * (replica count) × DB_POOL_MAX, so size this under the RDS instance's
 * max_connections with headroom. 10 is fine for a handful of replicas on a
 * small instance; raise it only alongside a larger DB (or an RDS Proxy /
 * PgBouncer in front, in which case keep this modest and let the proxy pool).
 */
const POOL_MAX = parseInt(process.env.DB_POOL_MAX ?? '10', 10);

/**
 * RDS terminates non-SSL connections by default. Set DATABASE_SSL=true in
 * the deployed environment. Locally (Docker Postgres) leave it unset.
 * rejectUnauthorized=false trusts the RDS-managed cert without bundling the
 * RDS CA; set DATABASE_SSL_STRICT=true + bundle the CA for full verification.
 */
function sslConfig() {
  if (process.env.DATABASE_SSL !== 'true') return undefined;
  return { rejectUnauthorized: process.env.DATABASE_SSL_STRICT === 'true' };
}

export function pool(): Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. Configure it in .env.local.');
    }
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: POOL_MAX,
      idleTimeoutMillis: 30_000,
      // Fail fast when the pool is saturated rather than hanging the request
      // (and holding the HTTP connection open) indefinitely.
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT_MS ?? '10000', 10),
      ssl: sslConfig(),
    });
  }
  return _pool;
}

export async function query<T = any>(sql: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number }> {
  const p = pool();
  const result = await p.query(sql, params);
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
}

export async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const p = pool();
  const c = await p.connect();
  try { return await fn(c); }
  finally { c.release(); }
}
