'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { PromoteModal } from '@/components/admin/promote-modal';

const fetcher = (u: string) => fetch(u).then((r) => r.json());

interface Item {
  id: string;
  question: string;
  session_id: string;
  created_at: string;
}

export default function UnansweredPage() {
  const { data, mutate } = useSWR<{ items: Item[] }>('/api/admin/unanswered', fetcher);
  const [promoteFor, setPromoteFor] = useState<Item | null>(null);

  const dismiss = async (id: string) => {
    await fetch(`/api/admin/unanswered/${id}/dismiss`, { method: 'POST' });
    mutate();
  };

  return (
    <div>
      <h2 className="text-2xl mb-4">Unanswered questions</h2>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-slate-500">
          <th>Question</th><th>When</th><th></th>
        </tr></thead>
        <tbody>
          {(data?.items ?? []).map((it) => (
            <tr key={it.id} className="border-t">
              <td className="py-2">{it.question}</td>
              <td className="py-2 text-slate-500">{new Date(it.created_at).toLocaleString()}</td>
              <td className="py-2 text-right">
                <button className="text-blue-700 underline mr-3" onClick={() => setPromoteFor(it)}>Answer & add to KB</button>
                <button className="text-slate-500 underline" onClick={() => dismiss(it.id)}>Dismiss</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {promoteFor && (
        <PromoteModal
          messageId=""
          initialQuestion={promoteFor.question}
          initialAnswer=""
          source="promoted_from_unanswered"
          onClose={async () => { setPromoteFor(null); await dismiss(promoteFor.id); mutate(); }}
        />
      )}
    </div>
  );
}
