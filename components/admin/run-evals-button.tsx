'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { EvalRunProgress } from './eval-run-progress';

export function RunEvalsButton() {
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On load, reattach to a run that's already in progress so the live status
  // resumes after a refresh or revisit (the run keeps advancing in the DB
  // regardless of whether this page is open).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/admin/eval-runs');
      if (!res.ok || cancelled) return;
      const { runs } = await res.json();
      const active = (runs ?? []).find(
        (r: { status: string }) => r.status === 'pending' || r.status === 'running',
      );
      if (active && !cancelled) {
        setRunId(active.id);
        setCompleted(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function start() {
    setStarting(true);
    setError(null);
    setCompleted(false);
    const res = await fetch('/api/admin/eval-runs', { method: 'POST' });
    setStarting(false);
    if (!res.ok) {
      setError(`HTTP ${res.status}`);
      return;
    }
    const { id } = await res.json();
    setRunId(id);
  }

  const [cancelling, setCancelling] = useState(false);
  async function cancel() {
    if (!runId) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/eval-runs/${runId}/cancel`, { method: 'POST' });
      if (!res.ok) setError(`Couldn't cancel (HTTP ${res.status}).`);
      // The poller will see status='cancelled' and finish the live view.
    } catch {
      setError('Network error while cancelling.');
    } finally {
      setCancelling(false);
    }
  }

  const inFlight = runId !== null && !completed;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={start}
          disabled={starting || inFlight}
          className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 disabled:opacity-50"
        >
          {starting ? 'Starting…' : inFlight ? 'Running…' : 'Run full eval suite'}
        </button>
        {inFlight && (
          <button
            onClick={cancel}
            disabled={cancelling}
            className="border border-destructive text-destructive px-4 py-2 rounded hover:bg-destructive/10 disabled:opacity-50"
          >
            {cancelling ? 'Cancelling…' : 'Cancel'}
          </button>
        )}
        <Link href="/admin/evals/runs" className="text-sm text-primary underline">
          View run history
        </Link>
      </div>
      {error && <p className="text-destructive">Error: {error}</p>}
      {runId && (
        <EvalRunProgress
          runId={runId}
          onComplete={() => setCompleted(true)}
        />
      )}
    </div>
  );
}
