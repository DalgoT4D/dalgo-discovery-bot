'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface RunStatus {
  id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  total_cases: number;
  passed_count: number;
  failed_count: number;
  finished_at: string | null;
  error: string | null;
}

export function EvalRunProgress({ runId, onComplete }: { runId: string; onComplete?: () => void }) {
  const [run, setRun] = useState<RunStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const res = await fetch(`/api/admin/eval-runs/${runId}`);
      if (!res.ok) return;
      const { run: r } = await res.json();
      if (cancelled) return;
      setRun(r);
      if (r.status === 'succeeded' || r.status === 'failed') {
        onComplete?.();
        return;
      }
      setTimeout(tick, 2000);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [runId, onComplete]);

  if (!run) return <p>Loading run…</p>;
  const total = run.total_cases || 1;
  const done = run.passed_count + run.failed_count;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="border border-border rounded p-4 bg-muted">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium">Run {run.id.slice(0, 8)}…</span>
        <span className="text-sm capitalize">{run.status}</span>
      </div>
      <div className="w-full bg-background rounded h-2 overflow-hidden mb-2">
        <div className="bg-primary h-2 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-sm text-muted-foreground flex justify-between">
        <span>
          {done} / {total} cases
        </span>
        <span>
          ✓ {run.passed_count} · ✗ {run.failed_count}
        </span>
      </div>
      {run.error && <p className="text-destructive mt-2">Error: {run.error}</p>}
      {(run.status === 'succeeded' || run.status === 'failed') && (
        <Link
          href={`/admin/evals/runs/${run.id}`}
          className="text-primary underline text-sm mt-2 inline-block"
        >
          View full results →
        </Link>
      )}
    </div>
  );
}
