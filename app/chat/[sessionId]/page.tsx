'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChatStream, type ChatStreamHandle } from '@/components/chat-stream';
import { ProgressIngest } from '@/components/progress-ingest';

export default function ChatPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [ready, setReady] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [starters, setStarters] = useState<string[]>([]);
  const chatRef = useRef<ChatStreamHandle>(null);

  useEffect(() => {
    if (!ready) return;
    fetch(`/api/chat?session_id=${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        setGreeting(d.greeting ?? '');
        setStarters(d.starters ?? []);
      })
      .catch(() => {});
  }, [ready, sessionId]);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="border-b bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-slate-900">Dalgo Discovery</h1>
        <p className="text-xs text-slate-500">
          Ask anything about Dalgo — I&apos;ll ground my answers in real product capabilities.
        </p>
      </header>
      <main className="flex-1 overflow-hidden">
        {!ready && <ProgressIngest sessionId={sessionId} onReady={() => setReady(true)} />}
        {ready && (
          <ChatStream
            ref={chatRef}
            sessionId={sessionId}
            greeting={greeting}
            starters={starters}
          />
        )}
      </main>
    </div>
  );
}
