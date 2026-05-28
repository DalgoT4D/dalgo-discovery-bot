import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { EvalCasesTable } from '@/components/admin/eval-cases-table';

export default async function EvalsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <main className="max-w-6xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Eval Cases</h1>
          <p className="text-gray-600 text-sm">
            Test cases that grade the bot. Edit freely in building phase; run evals after batches.
          </p>
        </div>
        <Link
          href="/admin/evals/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          New case
        </Link>
      </header>
      <EvalCasesTable />
    </main>
  );
}
