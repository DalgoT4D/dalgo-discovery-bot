import { notFound } from 'next/navigation';
import { getEvalCase, listEvalCaseVersions } from '@/lib/db/queries/eval-cases';
import { EvalCaseEditor, type EvalCaseFormValue } from '@/components/admin/eval-case-editor';
import { TestCaseButton } from '@/components/admin/test-case-button';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEvalCasePage({ params }: PageProps) {
  const { id } = await params;
  const row = await getEvalCase(id);
  if (!row) notFound();

  const initial: EvalCaseFormValue = {
    case_key: row.case_key,
    bucket: row.bucket,
    input: row.input,
    expected: row.expected,
    judges: row.judges,
    enabled: row.enabled,
    notes: row.notes,
  };

  const versions = await listEvalCaseVersions(id);

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">{row.case_key}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Bucket: <span className="font-mono">{row.bucket}</span>
        {' · '}
        Last updated: {new Date(row.updated_at).toLocaleString()} by {row.updated_by}
      </p>

      <EvalCaseEditor initial={initial} mode="edit" caseId={id} />
      <TestCaseButton caseId={id} />

      <section className="mt-12">
        <h2 className="text-lg font-semibold mb-3">Version history ({versions.length})</h2>
        <ul className="space-y-2 text-sm">
          {versions.map((v) => (
            <li key={v.id} className="border border-border rounded p-3">
              <div className="text-xs text-muted-foreground">
                {new Date(v.updated_at).toLocaleString()} by {v.updated_by}
              </div>
              <div className="mt-1">
                {v.input.length > 200 ? v.input.slice(0, 200) + '…' : v.input}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
