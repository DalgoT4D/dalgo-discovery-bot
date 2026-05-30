'use client';
import useSWR from 'swr';
import { DocsRefreshButton } from '@/components/admin/docs-refresh-button';
import { Card } from '@/components/ui/card';

interface DocRow {
  id: string;
  url: string;
  title: string;
  last_fetched_at: string;
  chunk_count: number;
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function DocsPage() {
  const { data, mutate } = useSWR<{ items: DocRow[] }>('/api/admin/docs', fetcher);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Product docs</h1>
          <p className="text-sm text-muted-foreground">
            Indexed from <code className="font-mono">dalgot4d.github.io/dalgo_docs</code>. Used by the
            <code className="mx-1 font-mono">search_dalgo_docs</code> tool for how-to / configuration questions.
          </p>
        </div>
        <DocsRefreshButton onDone={() => mutate()} />
      </div>
      <Card className="p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2">Title</th>
              <th className="py-2">URL</th>
              <th className="py-2">Chunks</th>
              <th className="py-2">Last fetched</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="py-2 font-medium">{p.title}</td>
                <td className="py-2">
                  <a className="text-primary hover:underline" href={p.url} target="_blank" rel="noreferrer">
                    {p.url.replace(/^https?:\/\//, '')}
                  </a>
                </td>
                <td className="py-2">{p.chunk_count}</td>
                <td className="py-2 text-muted-foreground">
                  {new Date(p.last_fetched_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
