import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEvalRun, getEvalRunResults } from '@/lib/db/queries/eval-runs';
import { EvalResultDrilldown } from '@/components/admin/eval-result-drilldown';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage({ params }: PageProps) {
  const { id } = await params;
  const run = await getEvalRun(id);
  if (!run) notFound();
  const results = await getEvalRunResults(id);

  const byBucket = results.reduce<Record<string, { pass: number; fail: number }>>(
    (acc, r) => {
      const b = (acc[r.bucket] ??= { pass: 0, fail: 0 });
      if (r.pass) b.pass++;
      else b.fail++;
      return acc;
    },
    {},
  );

  const drillRows = results.map((r) => ({
    id: r.id,
    case_key: r.case_key,
    bucket: r.bucket,
    pass: r.pass,
    judge_results: r.judge_results as Array<{ pass: boolean; notes: string; judge?: string }>,
    bot_response: r.bot_response,
    retrieval_trace: r.retrieval_trace,
    tool_calls: r.tool_calls,
    latency_ms: r.latency_ms,
  }));

  return (
    <main className="max-w-6xl mx-auto p-6">
      <Link href="/admin/evals/runs" className="text-primary underline text-sm">
        ← all runs
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Run {id.slice(0, 8)}…</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {run.kind} · started {new Date(run.started_at).toLocaleString()} by {run.triggered_by} ·
        status: <strong>{run.status}</strong>
      </p>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {Object.entries(byBucket).map(([bucket, { pass, fail }]) => (
          <div key={bucket} className="border border-border rounded p-3">
            <div className="text-xs uppercase text-muted-foreground mb-1">{bucket}</div>
            <div className="text-sm">
              <span className="text-primary">{pass} ✓</span>
              {' · '}
              <span className="text-destructive">{fail} ✗</span>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">
          Failed cases ({drillRows.filter((r) => !r.pass).length})
        </h2>
        <div className="space-y-2 mb-8">
          {drillRows
            .filter((r) => !r.pass)
            .map((r) => (
              <EvalResultDrilldown key={r.id} result={r} />
            ))}
        </div>

        <h2 className="text-lg font-semibold mb-3">
          Passed cases ({drillRows.filter((r) => r.pass).length})
        </h2>
        <div className="space-y-2">
          {drillRows
            .filter((r) => r.pass)
            .map((r) => (
              <EvalResultDrilldown key={r.id} result={r} />
            ))}
        </div>
      </section>
    </main>
  );
}
