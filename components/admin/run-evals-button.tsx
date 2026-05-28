'use client';
import { useState } from 'react';
import Link from 'next/link';
import { EvalRunProgress } from './eval-run-progress';

export function RunEvalsButton() {
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
