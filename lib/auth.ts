import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { findAdminByEmail } from '@/lib/db/queries/admins';
import { seedSystemAdminFromEnv } from '@/lib/db/bootstrap';

const allowedDomains = (process.env.ADMIN_ALLOWED_EMAIL_DOMAINS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const providers = [];

providers.push(
  Credentials({
    id: 'admin-credentials',
    name: 'Email & password',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(creds) {
      // Best-effort seed on first sign-in attempt
      try {
        await seedSystemAdminFromEnv();
      } catch {
        // ignore — bootstrap is best-effort
      }
      const email = (creds?.email as string | undefined)?.toLowerCase().trim();
      const password = creds?.password as string | undefined;
      if (!email || !password) return null;
      const admin = await findAdminByEmail(email);
      if (!admin) return null;
      const ok = await compare(password, admin.password_hash);
      if (!ok) return null;
      return {
        id: admin.id,
        email: admin.email,
        name: admin.email,
        isSystem: admin.is_system,
      };
    },
  }),
);

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  // Self-hosted (Docker/EC2) behind our own proxy: trust the Host header.
  // Without this, Auth.js v5 rejects every request with UntrustedHost once
  // NODE_ENV=production (it only auto-trusts localhost under `next dev`).
  // Can also be set via the AUTH_TRUST_HOST env var.
  trustHost: true,
  pages: { signIn: '/signin' },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'admin-credentials') return true;
      if (!user.email) return false;
      const domain = user.email.split('@')[1]?.toLowerCase();
      if (!domain) return false;
      return allowedDomains.includes(domain);
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.isSystem = (user as { isSystem?: boolean }).isSystem ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id && session.user) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { isSystem?: boolean }).isSystem = !!token.isSystem;
      }
      return session;
    },
  },
});
