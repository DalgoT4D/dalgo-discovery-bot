'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SignInForm() {
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') || '/admin';
  const err = params.get('error');
  const [submitting, setSubmitting] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await signIn('admin-credentials', { username, password, callbackUrl });
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Admin sign in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {err && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
            {err === 'CredentialsSignin'
              ? 'Invalid username or password.'
              : `Error: ${err}`}
          </p>
        )}
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Username</span>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="mt-1"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">Password</span>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
              className="mt-1"
            />
          </label>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Generate a password hash with{' '}
          <code className="bg-muted px-1 rounded">npm run admin:hash &lt;password&gt;</code> and
          put it in <code className="bg-muted px-1 rounded">.env.local</code> as{' '}
          <code className="bg-muted px-1 rounded">ADMIN_PASSWORD_HASH</code>.
        </p>
      </CardContent>
    </Card>
  );
}
