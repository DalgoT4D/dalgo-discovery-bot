import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name?: string | null;
    isSystem?: boolean;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      isSystem?: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    isSystem?: boolean;
  }
}
