'use client';
import Link from 'next/link';
import useSWR from 'swr';
import type { EvalCaseRow } from '@/lib/db/queries/eval-cases';

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function EvalCasesTable() {
  const { data, error, isLoading } = useSWR<{ cases: EvalCaseRow[] }>(
    '/api/admin/eval-cases',
    fetcher,
  );

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p className="text-destructive">Error loading cases</p>;

  const cases = data?.cases ?? [];

  const byBucket = cases.reduce<Record<string, EvalCaseRow[]>>((acc, c) => {
    (acc[c.bucket] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(byBucket)
        .sort()
        .map(([bucket, rows]) => (
          <section key={bucket}>
            <h2 className="text-lg font-semibold mb-2">
              {bucket} ({rows.length})
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4">Key</th>
                  <th className="py-2 pr-4">Input</th>
                  <th className="py-2 pr-4">Enabled</th>
                  <th className="py-2 pr-4">Updated</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-border hover:bg-muted">
                    <td className="py-2 pr-4 font-mono text-xs">{c.case_key}</td>
                    <td className="py-2 pr-4">
                      {c.input.length > 80 ? c.input.slice(0, 80) + '…' : c.input}
                    </td>
                    <td className="py-2 pr-4">{c.enabled ? '✓' : '—'}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {new Date(c.updated_at).toLocaleString()} by {c.updated_by}
                    </td>
                    <td className="py-2">
                      <Link
                        href={`/admin/evals/${c.id}`}
                        className="text-primary underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
    </div>
  );
}
