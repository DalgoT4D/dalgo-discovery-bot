import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';

const allowedDomains = (process.env.ADMIN_ALLOWED_EMAIL_DOMAINS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const hasCredentials = Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD_HASH);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    ...(hasGoogle
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    ...(hasCredentials
      ? [
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
              if (!username || !password) return null;
              if (username !== process.env.ADMIN_USERNAME) return null;
              const ok = await compare(password, process.env.ADMIN_PASSWORD_HASH!);
              if (!ok) return null;
              return { id: 'admin', name: username, email: `${username}@local.admin` };
            },
          }),
        ]
      : []),
  ],
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    async signIn({ user, account }) {
      // Credentials provider already validated in authorize()
      if (account?.provider === 'admin-credentials') return true;
      // Google provider: require allowlisted email domain
      if (!user.email) return false;
      const domain = user.email.split('@')[1]?.toLowerCase();
      if (!domain) return false;
      return allowedDomains.includes(domain);
    },
  },
});
