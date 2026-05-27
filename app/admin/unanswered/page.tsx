'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { PromoteModal } from '@/components/admin/promote-modal';
import { Card } from '@/components/ui/card';

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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Unanswered questions</h1>
      <Card className="p-4">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground">
            <th>Question</th><th>When</th><th></th>
          </tr></thead>
          <tbody>
            {(data?.items ?? []).map((it) => (
              <tr key={it.id} className="border-t border-border">
                <td className="py-2">{it.question}</td>
                <td className="py-2 text-muted-foreground">{new Date(it.created_at).toLocaleString()}</td>
                <td className="py-2 text-right">
                  <button className="text-primary underline mr-3" onClick={() => setPromoteFor(it)}>Answer & add to KB</button>
                  <button className="text-muted-foreground underline" onClick={() => dismiss(it.id)}>Dismiss</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

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
