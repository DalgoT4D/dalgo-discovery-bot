'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GUEST_ACCESS } from '@/lib/guest-access';

/**
 * "Try the live platform as a guest" access card.
 *
 * Shows the shared, read-only guest credentials (copyable) plus a button that
 * opens the Dalgo login in a new tab. The user pastes the credentials, logs in,
 * lands on the demo workspace, and a built-in guided walkthrough takes over.
 *
 * Rendered in two places: inline in the chat (when the bot calls
 * `offer_guest_tour`) and from the always-visible header button.
 */
function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard may be unavailable; ignore
    }
  }
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <code className="block truncate text-sm text-foreground">{value}</code>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-background"
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  );
}

export function GuestAccessCard({ className }: { className?: string }) {
  return (
    <Card className={`border-l-[3px] border-l-primary p-4 ${className ?? ''}`}>
      <p className="text-sm font-semibold text-foreground">🚀 Try the live Dalgo platform</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Log in as a guest to explore a real workspace — already set up with data, charts and a
        dashboard. A short guided tour starts you off. (View-only, nothing you do is saved.)
      </p>

      <div className="mt-3 space-y-2">
        <CopyRow label="Email" value={GUEST_ACCESS.email} />
        <CopyRow label="Password" value={GUEST_ACCESS.password} />
      </div>

      <a href={GUEST_ACCESS.platformUrl} target="_blank" rel="noopener noreferrer">
        <Button type="button" size="sm" className="mt-3 w-full">
          Open Dalgo login →
        </Button>
      </a>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Tip: once inside, click “Take a tour” at the bottom-right.
      </p>
    </Card>
  );
}
