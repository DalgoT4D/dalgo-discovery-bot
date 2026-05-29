import Link from 'next/link';
import { listEvalRuns } from '@/lib/db/queries/eval-runs';

export default async function RunsHistoryPage() {
  const runs = await listEvalRuns({ limit: 50 });

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Eval run history</h1>
      <Link href="/admin/evals" className="text-primary underline text-sm">
        ← back to cases
      </Link>
      <table className="w-full mt-4 text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 pr-4">Started</th>
            <th className="py-2 pr-4">Triggered by</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Kind</th>
            <th className="py-2 pr-4">Pass / Fail</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-b border-border hover:bg-muted">
              <td className="py-2 pr-4">{new Date(r.started_at).toLocaleString()}</td>
              <td className="py-2 pr-4">{r.triggered_by}</td>
              <td className="py-2 pr-4">
                <span className={r.status === 'failed' ? 'text-destructive' : ''}>{r.status}</span>
              </td>
              <td className="py-2 pr-4">{r.kind}</td>
              <td className="py-2 pr-4">
                {r.passed_count} ✓ / {r.failed_count} ✗
              </td>
              <td className="py-2">
                <Link href={`/admin/evals/runs/${r.id}`} className="text-primary underline">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
