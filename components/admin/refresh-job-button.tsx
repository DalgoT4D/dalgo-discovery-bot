'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function RefreshJobButton({ onDone }: { onDone: () => void }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);

  const start = async () => {
    const res = await fetch('/api/admin/blogs/refresh', { method: 'POST' });
    const j = await res.json();
    setJobId(j.jobId);
  };

  useEffect(() => {
    if (!jobId) return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/admin/blogs/refresh/${jobId}`);
      const j = await res.json();
      setStatus(j.job);
      if (j.job?.status !== 'running') {
        clearInterval(id);
        setJobId(null);
        onDone();
      }
    }, 2000);
    return () => clearInterval(id);
  }, [jobId, onDone]);

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="primary"
        size="sm"
        onClick={start}
        disabled={!!jobId}
      >
        {jobId ? 'Refreshing…' : 'Refresh blogs'}
      </Button>
      {status && (
        <div className="text-xs text-muted-foreground">
          seen {status.posts_seen} · new {status.posts_new} · updated {status.posts_updated} · skipped {status.posts_skipped}
          {status.status !== 'running' && <> · <strong>{status.status}</strong></>}
        </div>
      )}
    </div>
  );
}
