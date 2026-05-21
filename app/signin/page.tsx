'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

export default function SignInPage() {
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
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="bg-white rounded shadow w-full max-w-sm p-6 space-y-5">
        <h1 className="text-2xl font-semibold">Admin sign in</h1>
        {err && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
            {err === 'CredentialsSignin' ? 'Invalid username or password.' : `Error: ${err}`}
          </p>
        )}
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="mt-1 w-full border rounded p-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full border rounded p-2"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-slate-900 text-white py-2 rounded disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-xs text-slate-500">
          Generate a password hash with{' '}
          <code className="bg-slate-100 px-1 rounded">npm run admin:hash &lt;password&gt;</code>
          {' '}and put it in <code className="bg-slate-100 px-1 rounded">.env.local</code> as{' '}
          <code className="bg-slate-100 px-1 rounded">ADMIN_PASSWORD_HASH</code>.
        </p>
      </div>
    </main>
  );
}
