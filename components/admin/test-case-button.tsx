'use client';
import { useState } from 'react';

interface RunResult {
  id: string;
  bucket: string;
  pass: boolean;
  judgeResults: Array<{ pass: boolean; notes: string; judge?: string }>;
  botResponse?: string;
  latencyMs?: number;
}

export function TestCaseButton({ caseId }: { caseId: string }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    const res = await fetch(`/api/admin/eval-cases/${caseId}/test`, { method: 'POST' });
    setRunning(false);
    if (!res.ok) {
      setError(`HTTP ${res.status}`);
      return;
    }
    const { result: r } = await res.json();
    setResult(r);
  }

  return (
    <div className="mt-4">
      <button
        onClick={run}
        disabled={running}
        className="bg-muted text-foreground border border-border px-4 py-2 rounded hover:bg-background disabled:opacity-50"
      >
        {running ? 'Running case (~10–30s)…' : 'Test this case now'}
      </button>
      {error && <p className="text-destructive mt-2">Error: {error}</p>}
      {result && (
        <div
          className={`mt-3 border rounded p-3 ${
            result.pass ? 'border-border bg-muted' : 'border-destructive/30 bg-destructive/5'
          }`}
        >
          <p className="font-medium">
            {result.pass ? '✓ Pass' : '✗ Fail'} · {result.latencyMs}ms
          </p>
          <ul className="text-sm mt-2 space-y-1">
            {result.judgeResults.map((j, idx) => (
              <li key={idx}>
                <span className="font-mono text-xs">{j.judge ?? `judge ${idx}`}</span>:{' '}
                {j.pass ? '✓' : '✗'} {j.notes}
              </li>
            ))}
          </ul>
          {result.botResponse && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold">Bot response</summary>
              <pre className="whitespace-pre-wrap mt-2 text-sm bg-background border border-border p-2 rounded">
                {result.botResponse}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
