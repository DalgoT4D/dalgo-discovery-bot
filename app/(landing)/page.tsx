'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SiteHeader } from '@/components/site-header';
import { WORK_DOMAINS } from '@/lib/work-domains';

const LS_EMAIL = 'dalgo_email';

type Mode = 'guest' | 'admin';

export default function Landing() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('guest');
  const [email, setEmail] = useState('');
  const [workDomain, setWorkDomain] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgUrl, setOrgUrl] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill the email from localStorage for returning users — convenience,
  // not gating. They still see and confirm the form. The server-side
  // /api/intake handles email-keyed resume (returns the existing session_id
  // if one exists for that email).
  useEffect(() => {
    const savedEmail = typeof window !== 'undefined' ? window.localStorage.getItem(LS_EMAIL) : null;
    if (savedEmail) setEmail(savedEmail);
  }, []);

  async function startSession(emailValue: string) {
    const res = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: emailValue,
        ...(workDomain ? { work_domain: workDomain } : {}),
        ...(orgName.trim() ? { org_name: orgName.trim() } : {}),
        ...(orgUrl.trim() ? { org_url: orgUrl.trim() } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        body?.error === 'invalid_body'
          ? 'Please enter a valid email address.'
          : 'Something went wrong. Please try again.',
      );
    }
    const { session_id } = (await res.json()) as { session_id: string };
    window.localStorage.setItem(LS_EMAIL, emailValue);
    router.push(`/chat/${session_id}`);
  }

  async function onGuestSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await startSession(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.');
      setSubmitting(false);
    }
  }

  async function onAdminSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Clear any stale admin cookie BEFORE signing in. Without this, a
      // failed signIn (bad creds) leaves any previous valid cookie intact,
      // and /api/admin-intake would happily authenticate via that old
      // cookie even though the form's creds were wrong.
      await signOut({ redirect: false });

      // Set the NextAuth cookie via Credentials. We do NOT trust the return value
      // (NextAuth v5-beta's client signIn for Credentials with redirect:false
      // doesn't reliably surface auth failures). The server-side admin-intake
      // call below is the actual gate.
      await signIn('admin-credentials', { email, password, redirect: false });

      const res = await fetch('/api/admin-intake', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });

      if (res.status === 401) {
        // Clear any half-set cookie so a subsequent guest session doesn't
        // appear as admin in the chat header.
        await signOut({ redirect: false });
        setError('Invalid email or password.');
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        // Same rationale as the 401 branch: clear any half-set cookie so a
        // subsequent guest session doesn't appear as admin in the chat header.
        await signOut({ redirect: false });
        setError('Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      const { session_id } = (await res.json()) as { session_id: string };
      window.localStorage.setItem(LS_EMAIL, email);
      router.push(`/chat/${session_id}`);
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword('');
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex flex-1 items-start justify-center px-4 pt-[14vh]">
        <div className="w-full max-w-md">
            <div className="flex justify-center">
              <span className="relative inline-flex h-14 w-14 items-center justify-center">
                <span aria-hidden className="absolute inset-0 rounded-full bg-primary/15" />
                <span aria-hidden className="relative h-10 w-10 rounded-full bg-primary" />
              </span>
            </div>

            <h1 className="mt-6 text-center text-3xl font-medium tracking-tight text-foreground">
              {mode === 'guest' ? 'Welcome to Dalgo' : 'Admin sign-in'}
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-center text-[15px] text-muted-foreground">
              {mode === 'guest'
                ? 'A grounded assistant that helps NGO leaders figure out if Dalgo fits their work.'
                : 'Sign in to test the bot and manage the knowledge base.'}
            </p>

            <Card className="mt-8 p-6">
              {mode === 'guest' ? (
                <form onSubmit={onGuestSubmit} className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium text-foreground">Your work email</span>
                    <Input
                      className="mt-1.5"
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="you@your-ngo.org"
                      disabled={submitting}
                      aria-label="Email address"
                    />
                  </label>
                  <select
                    value={workDomain}
                    onChange={(e) => setWorkDomain(e.target.value)}
                    required
                    disabled={submitting}
                    aria-label="Your role"
                    className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                  >
                    <option value="" disabled>
                      Your role
                    </option>
                    {WORK_DOMAINS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Organisation name"
                    disabled={submitting}
                    aria-label="Organisation name"
                  />
                  <Input
                    type="text"
                    inputMode="url"
                    value={orgUrl}
                    onChange={(e) => setOrgUrl(e.target.value)}
                    placeholder="Organisation website (optional)"
                    disabled={submitting}
                    aria-label="Organisation website (optional)"
                  />
                  <Button
                    type="submit"
                    disabled={submitting || !email || !workDomain || !orgName.trim()}
                    className="w-full"
                  >
                    {submitting ? 'Starting…' : 'Start chatting →'}
                  </Button>
                  {error ? (
                    <p className="text-center text-xs text-red-600" role="alert">
                      {error}
                    </p>
                  ) : (
                    <p className="text-center text-xs text-muted-foreground">
                      We&apos;ll save your conversation so you can come back to it.
                    </p>
                  )}
                  <div className="relative mt-2 flex items-center justify-center">
                    <div className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
                    <button
                      type="button"
                      className="relative bg-card px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => switchMode('admin')}
                    >
                      or continue as admin
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={onAdminSubmit} className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium text-foreground">Admin email</span>
                    <Input
                      className="mt-1.5"
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="admin@your-org.org"
                      disabled={submitting}
                      aria-label="Admin email"
                      autoComplete="email"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-foreground">Password</span>
                    <Input
                      className="mt-1.5"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="••••••••"
                      disabled={submitting}
                      aria-label="Password"
                      autoComplete="current-password"
                    />
                  </label>
                  <Button
                    type="submit"
                    disabled={submitting || !email || !password}
                    className="w-full"
                  >
                    {submitting ? 'Signing in…' : 'Sign in as admin'}
                  </Button>
                  {error && (
                    <p className="text-center text-xs text-red-600" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="text-center">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => switchMode('guest')}
                    >
                      ← back
                    </button>
                  </div>
                </form>
              )}
            </Card>

            <p className="mt-8 text-center text-xs uppercase tracking-wide text-muted-foreground">
              Used by NGOs worldwide
            </p>
          </div>
      </main>
    </div>
  );
}
