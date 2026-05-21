import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const allowedDomains = (process.env.ADMIN_ALLOWED_EMAIL_DOMAINS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const domain = user.email.split('@')[1]?.toLowerCase();
      if (!domain) return false;
      return allowedDomains.includes(domain);
    },
  },
});
