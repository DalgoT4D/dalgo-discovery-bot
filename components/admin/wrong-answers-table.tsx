'use client';
import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Card } from '@/components/ui/card';
import { WrongAnswerResolveModal } from '@/components/admin/wrong-answer-resolve-modal';

type Report = {
  id: number;
  message_id: string;
  reason: string;
  suggested_answer: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  fix_kind: string | null;
  fixed_kb_id: string | null;
  reported_by: string;
  reported_at: string;
  session_id: string;
  answer_text: string;
};

type FilterValue = 'pending' | 'resolved' | 'dismissed' | 'all';

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const FILTERS: FilterValue[] = ['pending', 'resolved', 'dismissed', 'all'];

export function WrongAnswersTable() {
  const [filter, setFilter] = useState<FilterValue>('pending');
  const [openId, setOpenId] = useState<number | null>(null);

  const qs = filter === 'all' ? '' : `?status=${filter}`;
  const { data, isLoading, error, mutate } = useSWR<{ reports: Report[] }>(
    `/api/admin/wrong-answers${qs}`,
    fetcher,
  );

  const reports = data?.reports ?? [];

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-muted-foreground">Error loading reports.</p>;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              'rounded-md px-3 py-1.5 text-sm capitalize ' +
              (filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80')
            }
          >
            {f}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {reports.map((r) => (
          <li key={r.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{r.reason}</span>
              <span className="text-xs text-muted-foreground">
                {r.status}
                {r.fix_kind ? ` · ${r.fix_kind}` : ''}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.answer_text}</p>
            {r.suggested_answer && (
              <p className="mt-1 text-xs text-foreground">Suggested: {r.suggested_answer}</p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                {r.reported_by} · {new Date(r.reported_at).toLocaleString()}
              </span>
              <Link
                className="text-primary underline"
                href={`/admin/conversations/${r.session_id}`}
              >
                View conversation
              </Link>
              {r.status === 'pending' && (
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => setOpenId(r.id)}
                >
                  Review &amp; fix
                </button>
              )}
            </div>
          </li>
        ))}
        {reports.length === 0 && (
          <li className="text-sm text-muted-foreground">No reports.</li>
        )}
      </ul>

      {openId !== null && (
        <WrongAnswerResolveModal
          reportId={openId}
          onClose={() => {
            setOpenId(null);
            void mutate();
          }}
        />
      )}
    </Card>
  );
}
