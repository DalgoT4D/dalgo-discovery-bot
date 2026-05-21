'use client';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';

type MessageRow = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: unknown;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function ConversationsPage() {
  const params = useSearchParams();
  const session_id = params.get('session_id');
  const { data } = useSWR<{ messages: MessageRow[] }>(
    session_id ? `/api/admin/conversations/${session_id}` : null,
    fetcher,
  );
  return (
    <div>
      <h2 className="text-2xl mb-4">Transcript</h2>
      {!session_id && <p>Pick a lead from the leads page.</p>}
      {(data?.messages ?? []).map((m) => {
        const content = m.content as { text?: string } | string | null;
        const text =
          typeof content === 'string'
            ? content
            : (content?.text ?? JSON.stringify(content));
        return (
          <div
            key={m.id}
            className={`my-2 ${m.role === 'user' ? 'text-slate-900' : 'text-blue-900'}`}
          >
            <strong>{m.role}:</strong> {text}
          </div>
        );
      })}
    </div>
  );
}
