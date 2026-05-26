'use client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { PromoteModal } from '@/components/admin/promote-modal';
import { RetrievalDebugPanel } from '@/components/admin/retrieval-debug-panel';
import { WrongAnswerModal } from '@/components/admin/wrong-answer-modal';

type MessageRow = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: unknown;
  created_at: string;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const { data } = useSWR<{ messages: MessageRow[] }>(
    `/api/admin/conversations/${sessionId}`,
    fetcher,
  );
  const [promoteFor, setPromoteFor] = useState<{ messageId: string; userMsgText: string; asstMsgText: string } | null>(null);
  const [debugFor, setDebugFor] = useState<string | null>(null);
  const [wrongFor, setWrongFor] = useState<string | null>(null);

  const messages = data?.messages ?? [];
  const findPrevUserText = (idx: number): string => {
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        const c = messages[i].content as any;
        return typeof c === 'string' ? c : c?.text ?? '';
      }
    }
    return '';
  };
  const asText = (c: unknown): string => {
    if (typeof c === 'string') return c;
    const t = (c as any)?.text;
    return typeof t === 'string' ? t : JSON.stringify(c);
  };

  return (
    <div>
      <h2 className="text-2xl mb-4">Transcript</h2>
      {messages.map((m, idx) => (
        <div key={m.id} className={`my-3 ${m.role === 'user' ? 'text-slate-900' : 'text-blue-900'}`}>
          <div className="text-xs text-slate-500 mb-1">{m.role}</div>
          <div>{asText(m.content)}</div>
          {m.role === 'assistant' && (
            <div className="mt-1 flex gap-2 text-xs">
              <button
                className="text-blue-700 underline"
                onClick={() => setPromoteFor({
                  messageId: m.id,
                  userMsgText: findPrevUserText(idx),
                  asstMsgText: asText(m.content),
                })}
              >↗ Promote to KB</button>
              <button
                className="text-slate-600 underline"
                onClick={() => setDebugFor(m.id)}
              >👁 View retrieval debug</button>
              <button
                className="text-red-600 underline"
                onClick={() => setWrongFor(m.id)}
              >⚠ This answer is wrong</button>
            </div>
          )}
        </div>
      ))}

      {promoteFor && (
        <PromoteModal
          messageId={promoteFor.messageId}
          initialQuestion={promoteFor.userMsgText}
          initialAnswer={promoteFor.asstMsgText}
          onClose={() => setPromoteFor(null)}
        />
      )}
      {debugFor && (
        <RetrievalDebugPanel messageId={debugFor} onClose={() => setDebugFor(null)} />
      )}
      {wrongFor && (
        <WrongAnswerModal messageId={wrongFor} onClose={() => setWrongFor(null)} />
      )}
    </div>
  );
}
