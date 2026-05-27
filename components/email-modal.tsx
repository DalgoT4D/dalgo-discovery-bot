'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function EmailModal({
  onSuccess,
}: {
  onSuccess: (data: { sessionId: string; email: string }) => void;
}) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Focus trap: keep tab focus inside the card.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const card = cardRef.current;
      if (!card) return;
      const focusables = card.querySelectorAll<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

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
      onSuccess({ sessionId: session_id, email });
      // Intentionally do NOT setSubmitting(false) — onSuccess will unmount the modal via redirect.
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-modal-title"
    >
      <div ref={cardRef} className="w-full max-w-md">
        <Card className="p-6">
          <h2
            id="email-modal-title"
            className="text-xl font-semibold text-foreground"
          >
            Tell us who you are
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            We&apos;ll save your conversation so you can come back to it.
          </p>
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <Input
              ref={inputRef}
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="you@your-ngo.org"
              disabled={submitting}
              aria-label="Email address"
            />
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={submitting || !email}
              className="w-full"
            >
              {submitting ? 'Starting…' : 'Start chatting →'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
