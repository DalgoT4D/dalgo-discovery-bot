'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface VersionRow {
  id: number;
  canonical_answer: string;
  question_variants: string[];
  updated_at: string;
  updated_by: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function KbVersionsPanel({ kbId }: { kbId: string }) {
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR<{ versions: VersionRow[] }>(
    `/api/admin/kb/${kbId}/versions`,
    fetcher,
  );
  const [restoring, setRestoring] = useState<number | null>(null);

  async function restore(versionId: number) {
    if (!confirm('Restore this version onto the current entry? Embedding will be regenerated.')) return;
    setRestoring(versionId);
    const res = await fetch(`/api/admin/kb/${kbId}/versions/${versionId}/restore`, { method: 'POST' });
    setRestoring(null);
    if (res.ok) {
      await mutate(); // refresh the versions list
      router.refresh(); // refresh server component data
    } else {
      alert(`Restore failed: HTTP ${res.status}`);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading versions…</p>;
  const versions = data?.versions ?? [];
  if (versions.length === 0) return <p className="text-sm text-muted-foreground">No prior versions yet.</p>;

  return (
    <ul className="space-y-2 text-sm">
      {versions.map((v) => (
        <li key={v.id} className="border border-border rounded p-3 flex justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              {new Date(v.updated_at).toLocaleString()} by {v.updated_by}
            </div>
            <div className="font-medium">{v.question_variants[0] ?? '(no question)'}</div>
            <div className="text-muted-foreground mt-1">
              {v.canonical_answer.length > 240 ? v.canonical_answer.slice(0, 240) + '…' : v.canonical_answer}
            </div>
          </div>
          <div>
            <button
              onClick={() => restore(v.id)}
              disabled={restoring !== null}
              className="border border-primary text-primary px-3 py-1 rounded text-sm hover:bg-primary/10 disabled:opacity-50"
            >
              {restoring === v.id ? 'Restoring…' : 'Restore'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
