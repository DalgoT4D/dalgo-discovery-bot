import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';

const allowedDomains = (process.env.ADMIN_ALLOWED_EMAIL_DOMAINS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Build providers array. We always register Credentials (harmless if env unset —
// authorize() will just return null). We only register Google if both client id
// and secret are present, because Google's constructor validates them.
const providers = [];

providers.push(
  Credentials({
    id: 'admin-credentials',
    name: 'Username & password',
    credentials: {
      username: { label: 'Username', type: 'text' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(creds) {
      const username = creds?.username as string | undefined;
      const password = creds?.password as string | undefined;
      const adminUser = process.env.ADMIN_USERNAME;
      const adminHash = process.env.ADMIN_PASSWORD_HASH;
      if (!username || !password) return null;
      if (!adminUser || !adminHash) return null;
      if (username !== adminUser) return null;
      const ok = await compare(password, adminHash);
      if (!ok) return null;
      return { id: 'admin', name: username, email: `${username}@local.admin` };
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
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'admin-credentials') return true;
      if (!user.email) return false;
      const domain = user.email.split('@')[1]?.toLowerCase();
      if (!domain) return false;
      return allowedDomains.includes(domain);
    },
  },
});
