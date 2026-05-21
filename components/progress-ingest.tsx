'use client';
import { useEffect, useState } from 'react';

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

  return (
    <div className="text-center py-8 text-slate-500">
      Learning about your NGO… {tries > 0 && `(${tries}s)`}
    </div>
  );
}
