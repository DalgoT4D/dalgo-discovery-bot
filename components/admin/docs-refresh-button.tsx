'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface DocJob {
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  pages_seen: number;
  pages_new: number;
  pages_updated: number;
  pages_skipped: number;
  error: string | null;
}

export function DocsRefreshButton({ onDone }: { onDone: () => void }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<DocJob | null>(null);

  const start = async () => {
    const res = await fetch('/api/admin/docs/refresh', { method: 'POST' });
    const j = await res.json();
    setJobId(j.jobId);
  };

  useEffect(() => {
    if (!jobId) return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/admin/docs/refresh/${jobId}`);
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
      <Button variant="primary" size="sm" onClick={start} disabled={!!jobId}>
        {jobId ? 'Refreshing…' : 'Refresh docs'}
      </Button>
      {status && (
        <div className="text-xs text-muted-foreground">
          seen {status.pages_seen} · new {status.pages_new} · updated {status.pages_updated} · skipped {status.pages_skipped}
          {status.status !== 'running' && <> · <strong>{status.status}</strong></>}
        </div>
      )}
    </div>
  );
}
