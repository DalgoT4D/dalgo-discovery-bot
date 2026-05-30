'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { RefreshJobButton } from '@/components/admin/refresh-job-button';
import { Card } from '@/components/ui/card';
import { useTableFilter } from '@/components/admin/table-filter';

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type BlogRow = {
  id: string;
  title: string;
  category: string;
  published_at: string | null;
  chunk_count: number;
  last_fetched_at: string;
};

export default function BlogsPage() {
  const { data, mutate } = useSWR<{ items: BlogRow[] }>('/api/admin/blogs', fetcher);
  const { rows, bar } = useTableFilter(data?.items, {
    search: (a) => [a.title, a.category],
    searchPlaceholder: 'Search blog titles… (use /regex/ for patterns)',
    facets: [{ key: 'category', label: 'Category', value: (a) => a.category }],
    date: { label: 'Published', value: (a) => a.published_at },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-foreground">Blogs</h1>
        <RefreshJobButton onDone={() => mutate()} />
      </div>
      <Card className="p-4 space-y-4">
        {bar}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th>Title</th>
              <th>Category</th>
              <th>Published</th>
              <th>Chunks</th>
              <th>Last fetched</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="py-2">
                  <Link className="text-primary hover:underline" href={`/admin/blogs/${a.id}`}>
                    {a.title}
                  </Link>
                </td>
                <td className="py-2">{a.category}</td>
                <td className="py-2">{a.published_at ?? '—'}</td>
                <td className="py-2">{a.chunk_count}</td>
                <td className="py-2 text-muted-foreground">{new Date(a.last_fetched_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
