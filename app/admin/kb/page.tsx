import { KbTable } from '@/components/admin/kb-table';
import Link from 'next/link';

export default function KbListPage() {
  return (
    <div className="space-y-4">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-foreground">Knowledge Base</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/kb/import"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-primary px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            Import via paste
          </Link>
          <Link
            href="/admin/kb/new"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            New entry
          </Link>
        </div>
      </header>
      <KbTable />
    </div>
  );
}
