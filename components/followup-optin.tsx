'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const LS_KEY = (sessionId: string) => `dalgo_followup_${sessionId}`;

export function FollowupOptin({
  sessionId,
  email,
}: {
  sessionId: string;
  email?: string | null;
}) {
  const initiallyHidden =
    typeof window !== 'undefined' && !!window.localStorage.getItem(LS_KEY(sessionId));
  const [done, setDone] = useState(initiallyHidden);
  const [submitting, setSubmitting] = useState(false);

  if (done || !email) return null;

  function remember() {
    try {
      window.localStorage.setItem(LS_KEY(sessionId), '1');
    } catch {
      // ignore storage failures
    }
  }

  async function optIn() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/followup', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) throw new Error('failed');
      remember();
      setDone(true);
    } catch {
      setSubmitting(false); // keep the card so they can retry
    }
  }

  function dismiss() {
    remember();
    setDone(true);
  }

  return (
    <Card className="border-l-[3px] border-l-primary px-4 py-3">
      <p className="text-sm font-medium text-foreground">
        Want the Dalgo team to reach out to you at{' '}
        <span className="text-primary">{email}</span>?
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button type="button" size="sm" onClick={optIn} disabled={submitting}>
          {submitting ? 'Saving…' : 'Yes, please'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
          No thanks
        </Button>
      </div>
    </Card>
  );
}
