'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useTableFilter } from '@/components/admin/table-filter';

type KbRow = {
  id: string;
  category: string;
  question_variants: string[] | null;
  status: string;
  last_verified: string;
  notes_for_sales: string | null;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function KbTable() {
  const { data, error, isLoading } = useSWR<{ items: KbRow[] }>('/api/admin/kb', fetcher);
  const { rows, bar } = useTableFilter(data?.items, {
    search: (it) => [...(it.question_variants ?? []), it.notes_for_sales, it.category],
    searchPlaceholder: 'Search questions, notes… (use /regex/ for patterns)',
    facets: [
      { key: 'category', label: 'Category', value: (it) => it.category },
      { key: 'status', label: 'Status', value: (it) => it.status },
    ],
    date: { label: 'Last verified', value: (it) => it.last_verified },
  });
  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>Error.</p>;

  return (
    <Card className="p-4 space-y-4">
      {bar}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-border">
            <th className="p-2">Category</th>
            <th className="p-2">Question (first variant)</th>
            <th className="p-2">Status</th>
            <th className="p-2">Last verified</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it) => (
            <tr key={it.id} className="border-b border-border">
              <td className="p-2">{it.category}</td>
              <td className="p-2">{it.question_variants?.[0]}</td>
              <td className="p-2">
                <StatusBadge status={it.status} />
              </td>
              <td className="p-2">{new Date(it.last_verified).toLocaleDateString()}</td>
              <td className="p-2">
                <Link href={`/admin/kb/${it.id}`} className="text-primary underline">
                  edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    yes: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    no: 'bg-red-100 text-red-800',
    roadmap: 'bg-blue-100 text-blue-800',
  };
  return <span className={`px-2 py-1 rounded text-xs ${colors[status] ?? ''}`}>{status}</span>;
}
