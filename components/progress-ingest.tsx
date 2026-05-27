'use client';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';

export function ProgressIngest({
  sessionId,
  onReady,
}: {
  sessionId: string;
  onReady: () => void;
}) {
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/chat?session_id=${sessionId}`);
        if (cancelled) return;
        if (res.ok) {
          onReady();
          return;
        }
      } catch {}
      if (!cancelled) {
        setTries((t) => t + 1);
        setTimeout(poll, 1500);
      }
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId, onReady]);

  // 1.5s per poll, so > 4 tries ≈ > 6s elapsed → switch the sub-line.
  const slow = tries > 4;

  return (
    <div className="flex h-full items-center justify-center px-4">
      <Card className="w-full max-w-sm px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          <p className="text-[15px] font-medium text-foreground">Learning about your NGO…</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground animate-in fade-in duration-500" key={slow ? 'slow' : 'fast'}>
          {slow ? 'Almost there…' : 'This usually takes a few seconds.'}
        </p>
      </Card>
    </div>
  );
}
