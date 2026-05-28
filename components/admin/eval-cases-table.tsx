'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface EvalCaseRow {
  id: string;
  case_key: string;
  bucket: string;
  input: string;
  enabled: boolean;
  updated_at: string;
  updated_by: string;
}

export function EvalCasesTable() {
  const [cases, setCases] = useState<EvalCaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/eval-cases')
      .then((r) => r.json())
      .then((data) => setCases(data.cases ?? []))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;

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
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Key</th>
                  <th className="py-2 pr-4">Input</th>
                  <th className="py-2 pr-4">Enabled</th>
                  <th className="py-2 pr-4">Updated</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 pr-4 font-mono text-xs">{c.case_key}</td>
                    <td className="py-2 pr-4">
                      {c.input.length > 80 ? c.input.slice(0, 80) + '…' : c.input}
                    </td>
                    <td className="py-2 pr-4">{c.enabled ? '✓' : '—'}</td>
                    <td className="py-2 pr-4 text-xs text-gray-500">
                      {new Date(c.updated_at).toLocaleString()} by {c.updated_by}
                    </td>
                    <td className="py-2">
                      <Link
                        href={`/admin/evals/${c.id}`}
                        className="text-blue-600 hover:underline"
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
