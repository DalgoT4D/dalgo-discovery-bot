'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { RefreshJobButton } from '@/components/admin/refresh-job-button';
import { Card } from '@/components/ui/card';

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function BlogsPage() {
  const { data, mutate } = useSWR<{ items: any[] }>('/api/admin/blogs', fetcher);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-foreground">Blogs</h1>
        <RefreshJobButton onDone={() => mutate()} />
      </div>
      <Card className="p-4">
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
            {(data?.items ?? []).map((a) => (
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
