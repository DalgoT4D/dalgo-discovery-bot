'use client';
import { useState } from 'react';

interface ResultRow {
  id: number;
  case_key: string;
  bucket: string;
  pass: boolean;
  judge_results: Array<{ pass: boolean; notes: string; judge?: string }>;
  bot_response: string | null;
  retrieval_trace: unknown;
  tool_calls: unknown;
  latency_ms: number | null;
}

export function EvalResultDrilldown({ result }: { result: ResultRow }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={`border rounded p-3 ${
        result.pass ? 'border-border bg-muted' : 'border-destructive/30 bg-destructive/5'
      }`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-left w-full flex justify-between items-start"
      >
        <span className="font-mono text-sm">
          {result.pass ? '✓' : '✗'} {result.case_key}
          <span className="text-muted-foreground ml-2">({result.bucket})</span>
        </span>
        <span className="text-muted-foreground text-xs">
          {result.latency_ms}ms · {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 text-sm">
          <Section title="Judge results">
            <ul className="space-y-1">
              {result.judge_results.map((j, idx) => (
                <li
                  key={idx}
                  className="border-l-2 pl-2"
                  style={{
                    borderColor: j.pass ? 'var(--color-primary)' : 'var(--color-destructive)',
                  }}
                >
                  <span className="font-mono">{j.judge ?? `judge ${idx}`}</span>:{' '}
                  {j.pass ? '✓' : '✗'} — {j.notes}
                </li>
              ))}
            </ul>
          </Section>

          {result.bot_response && (
            <Section title="Bot response">
              <pre className="whitespace-pre-wrap bg-background border border-border p-2 rounded">
                {result.bot_response}
              </pre>
            </Section>
          )}

          {result.retrieval_trace !== null && (
            <Section title="Retrieval trace">
              <pre className="whitespace-pre-wrap bg-background border border-border p-2 rounded text-xs overflow-x-auto">
                {JSON.stringify(result.retrieval_trace, null, 2)}
              </pre>
            </Section>
          )}

          {Array.isArray(result.tool_calls) && result.tool_calls.length > 0 && (
            <Section title="Tool calls">
              <pre className="whitespace-pre-wrap bg-background border border-border p-2 rounded text-xs overflow-x-auto">
                {JSON.stringify(result.tool_calls, null, 2)}
              </pre>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">
        {title}
      </h4>
      {children}
    </div>
  );
}
