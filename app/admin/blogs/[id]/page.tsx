'use client';
import { useParams } from 'next/navigation';
import useSWR from 'swr';

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function BlogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useSWR<{ article: any; chunks: any[] }>(`/api/admin/blogs/${id}`, fetcher);
  if (!data) return <div>Loading…</div>;
  const { article, chunks } = data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl">{article.title}</h2>
        <div className="text-sm text-slate-500">
          <a href={article.url} className="hover:underline" target="_blank" rel="noopener">
            {article.url}
          </a>
        </div>
      </div>
      <section>
        <h3 className="font-semibold mb-1">Article context</h3>
        <p className="text-sm">{article.article_context}</p>
      </section>
      <section>
        <h3 className="font-semibold mb-1">Chunks ({chunks.length})</h3>
        <ol className="space-y-2">
          {chunks.map((c) => (
            <li key={c.chunk_index} className="text-xs border rounded p-2">
              <div className="text-slate-500">chunk #{c.chunk_index}</div>
              <pre className="whitespace-pre-wrap font-sans">{c.chunk_text}</pre>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
