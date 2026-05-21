import { KbTable } from '@/components/admin/kb-table';
import Link from 'next/link';

export default function KbListPage() {
  return (
    <div className="space-y-4">
      <header className="flex justify-between items-center">
        <h2 className="text-2xl">Knowledge Base</h2>
        <Link
          href="/admin/kb/new"
          className="bg-slate-900 text-white px-3 py-2 rounded text-sm"
        >
          New entry
        </Link>
      </header>
      <KbTable />
    </div>
  );
}
