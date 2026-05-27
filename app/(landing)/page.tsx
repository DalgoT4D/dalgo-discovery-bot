'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SiteHeader } from '@/components/site-header';

const LS_SESSION = 'dalgo_session_id';
const LS_EMAIL = 'dalgo_email';

export default function Landing() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(LS_SESSION) : null;
    if (saved) {
      router.replace(`/chat/${saved}`);
      return;
    }
    setChecked(true);
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body?.error === 'invalid_body'
            ? 'Please enter a valid email address.'
            : 'Something went wrong. Please try again.',
        );
        setSubmitting(false);
        return;
      }
      const { session_id } = (await res.json()) as { session_id: string };
      window.localStorage.setItem(LS_SESSION, session_id);
      window.localStorage.setItem(LS_EMAIL, email);
      router.push(`/chat/${session_id}`);
      // intentionally don't reset submitting — page is about to unmount
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex flex-1 items-start justify-center px-4 pt-[14vh]">
        {checked && (
          <div className="w-full max-w-md">
            {/* Brand hero */}
            <div className="flex justify-center">
              <span className="relative inline-flex h-14 w-14 items-center justify-center">
                <span aria-hidden className="absolute inset-0 rounded-full bg-primary/15" />
                <span aria-hidden className="relative h-10 w-10 rounded-full bg-primary" />
              </span>
            </div>

            <h1 className="mt-6 text-center text-3xl font-medium tracking-tight text-foreground">
              Welcome to Dalgo
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-center text-[15px] text-muted-foreground">
              A grounded assistant that helps NGO leaders figure out if Dalgo fits their work.
            </p>

            <Card className="mt-8 p-6">
              <form onSubmit={onSubmit} className="space-y-3">
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
                <Button type="submit" disabled={submitting || !email} className="w-full">
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
              </form>
            </Card>

            <p className="mt-8 text-center text-xs uppercase tracking-wide text-muted-foreground">
              Used by NGOs worldwide
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
