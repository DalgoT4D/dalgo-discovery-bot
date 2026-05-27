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
  await createAdmin({
    email: `${username}@local.admin`,
    passwordHash: hash,
    isSystem: true,
    createdBy: null,
  });
}
