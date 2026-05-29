import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { auth } from '@/lib/auth';
import { listAdmins, createAdmin, findAdminByEmail } from '@/lib/db/queries/admins';

async function requireSystemAdmin() {
  const session = await auth();
  if (!session?.user || !(session.user as { isSystem?: boolean }).isSystem) {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireSystemAdmin();
  if (!session) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const admins = await listAdmins();
  return NextResponse.json({ admins });
}

const CreateBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const session = await requireSystemAdmin();
  if (!session) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const email = parsed.data.email.toLowerCase().trim();
  const existing = await findAdminByEmail(email);
  if (existing) {
    return NextResponse.json({ error: 'email_taken' }, { status: 409 });
  }
  const passwordHash = await hash(parsed.data.password, 10);
  const admin = await createAdmin({
    email,
    passwordHash,
    createdBy: (session.user as { id: string }).id,
    isSystem: false,
  });
  return NextResponse.json({ admin });
}
