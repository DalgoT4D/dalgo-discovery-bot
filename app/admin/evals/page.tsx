import Link from 'next/link';
import { EvalCasesTable } from '@/components/admin/eval-cases-table';

export default async function EvalsPage() {
  return (
    <main className="max-w-6xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Eval Cases</h1>
          <p className="text-muted-foreground text-sm">
            Test cases that grade the bot. Edit freely in building phase; run evals after batches.
          </p>
        </div>
        <Link
          href="/admin/evals/new"
          className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
        >
          New case
        </Link>
      </header>
      <EvalCasesTable />
    </main>
  );
}
