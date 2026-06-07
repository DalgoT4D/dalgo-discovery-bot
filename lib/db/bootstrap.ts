import { countAdmins, createAdmin } from './queries/admins';

let seeded = false;

export async function seedSystemAdminFromEnv(): Promise<void> {
  if (seeded) return;
  seeded = true;
  const username = process.env.ADMIN_USERNAME;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!username || !hash) return;
  const count = await countAdmins();
  if (count > 0) return;
  // If ADMIN_USERNAME is already an email, use it verbatim as the login email;
  // otherwise synthesize a local one (e.g. "admin" -> "admin@local.admin").
  const email = username.includes('@') ? username.toLowerCase() : `${username}@local.admin`;
  await createAdmin({
    email,
    passwordHash: hash,
    isSystem: true,
    createdBy: null,
  });
}
