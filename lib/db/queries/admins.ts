import { query } from '@/lib/db/client';

export interface AdminRow {
  id: string;
  email: string;
  is_system: boolean;
  created_at: string;
  created_by: string | null;
}

export interface AdminWithHash extends AdminRow {
  password_hash: string;
}

export async function findAdminByEmail(email: string): Promise<AdminWithHash | null> {
  const { rows } = await query<AdminWithHash>(
    `SELECT id, email, password_hash, is_system, created_at, created_by
     FROM admins WHERE email = $1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function listAdmins(): Promise<AdminRow[]> {
  const { rows } = await query<AdminRow>(
    `SELECT id, email, is_system, created_at, created_by
     FROM admins ORDER BY is_system DESC, created_at ASC`,
  );
  return rows;
}

export async function createAdmin(args: {
  email: string;
  passwordHash: string;
  createdBy: string | null;
  isSystem?: boolean;
}): Promise<AdminRow> {
  const { rows } = await query<AdminRow>(
    `INSERT INTO admins (email, password_hash, is_system, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, is_system, created_at, created_by`,
    [args.email, args.passwordHash, args.isSystem ?? false, args.createdBy],
  );
  return rows[0];
}

export async function deleteAdmin(id: string): Promise<void> {
  await query(`DELETE FROM admins WHERE id = $1`, [id]);
}

export async function countAdmins(): Promise<number> {
  const { rows } = await query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM admins`);
  return rows[0]?.c ?? 0;
}
