'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { RefreshJobButton } from '@/components/admin/refresh-job-button';

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function BlogsPage() {
  const { data, mutate } = useSWR<{ items: any[] }>('/api/admin/blogs', fetcher);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl">Blogs</h2>
        <RefreshJobButton onDone={() => mutate()} />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th>Title</th>
            <th>Category</th>
            <th>Published</th>
            <th>Chunks</th>
            <th>Last fetched</th>
          </tr>
        </thead>
        <tbody>
          {(data?.items ?? []).map((a) => (
            <tr key={a.id} className="border-t">
              <td className="py-2">
                <Link className="text-blue-700 hover:underline" href={`/admin/blogs/${a.id}`}>
                  {a.title}
                </Link>
              </td>
              <td className="py-2">{a.category}</td>
              <td className="py-2">{a.published_at ?? '—'}</td>
              <td className="py-2">{a.chunk_count}</td>
              <td className="py-2 text-slate-500">{new Date(a.last_fetched_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
