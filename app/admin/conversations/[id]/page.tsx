'use client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { PromoteModal } from '@/components/admin/promote-modal';
import { RetrievalDebugPanel } from '@/components/admin/retrieval-debug-panel';
import { WrongAnswerModal } from '@/components/admin/wrong-answer-modal';
import { Markdown } from '@/components/markdown';
import { Card } from '@/components/ui/card';

type WrongStatus = 'pending' | 'resolved' | 'dismissed';

type MessageRow = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: unknown;
  created_at: string;
  wrong_status?: WrongStatus | null;
  wrong_reason?: string | null;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// Highlight messages that were flagged as wrong, colored by report status.
// pending = needs attention (red), resolved = fixed in KB (green),
// dismissed = judged not-wrong (muted/struck).
const WRONG_STYLES: Record<WrongStatus, { card: string; badge: string; label: string }> = {
  pending: {
    card: 'border-red-500 bg-red-50 dark:bg-red-950/30',
    badge: 'bg-red-600 text-white',
    label: 'Marked wrong · pending',
  },
  resolved: {
    card: 'border-green-600 bg-green-50 dark:bg-green-950/30',
    badge: 'bg-green-600 text-white',
    label: 'Marked wrong · resolved',
  },
  dismissed: {
    card: 'border-muted-foreground/40 bg-muted/40',
    badge: 'bg-muted-foreground/70 text-background',
    label: 'Marked wrong · dismissed',
  },
};

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
      <h1 className="text-2xl font-semibold text-foreground mb-4">Transcript</h1>
      <div className="space-y-4">
        {messages.map((m, idx) => {
          const text = asText(m.content);
          const wrong = m.wrong_status ? WRONG_STYLES[m.wrong_status] : null;
          return (
            <Card key={m.id} className={'p-4' + (wrong ? ' ' + wrong.card : '')}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {m.role}
                </span>
                {wrong && (
                  <span
                    className={'rounded px-1.5 py-0.5 text-[10px] font-medium ' + wrong.badge}
                    title={m.wrong_reason ?? undefined}
                  >
                    {wrong.label}
                  </span>
                )}
              </div>
              <div className="text-[15px] leading-relaxed text-foreground">
                {m.role === 'assistant' ? (
                  <Markdown text={text} />
                ) : (
                  <p className="whitespace-pre-wrap">{text}</p>
                )}
              </div>
              {m.role === 'assistant' && (
                <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3 text-xs">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setPromoteFor({
                      messageId: m.id,
                      userMsgText: findPrevUserText(idx),
                      asstMsgText: text,
                    })}
                  >↗ Promote to KB</button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:underline"
                    onClick={() => setDebugFor(m.id)}
                  >👁 View retrieval debug</button>
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() => setWrongFor(m.id)}
                  >⚠ This answer is wrong</button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

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
