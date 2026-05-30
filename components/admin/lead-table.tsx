'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useTableFilter } from '@/components/admin/table-filter';

type LeadRow = {
  id: string;
  created_at: string;
  email: string;
  intent: string;
  session_id: string;
  ngo_url: string | null;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function LeadTable() {
  const { data, error, isLoading } = useSWR<{ items: LeadRow[] }>('/api/admin/leads', fetcher);
  const { rows, bar } = useTableFilter(data?.items, {
    search: (l) => [l.email, l.intent, l.ngo_url],
    searchPlaceholder: 'Search email, NGO URL… (use /regex/ for patterns)',
    facets: [{ key: 'intent', label: 'Intent', value: (l) => l.intent }],
    date: { label: 'Created', value: (l) => l.created_at },
  });
  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>Error.</p>;
  return (
    <Card className="p-4 space-y-4">
      {bar}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-border">
            <th className="p-2">Created</th>
            <th className="p-2">Email</th>
            <th className="p-2">Intent</th>
            <th className="p-2">NGO URL</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="border-b border-border">
              <td className="p-2">{new Date(l.created_at).toLocaleString()}</td>
              <td className="p-2">{l.email}</td>
              <td className="p-2">{l.intent}</td>
              <td className="p-2">{l.ngo_url ?? '—'}</td>
              <td className="p-2">
                <Link
                  href={`/admin/conversations?session_id=${l.session_id}`}
                  className="text-primary underline"
                >
                  transcript
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
