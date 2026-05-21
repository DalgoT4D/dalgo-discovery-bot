'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChatStream } from '@/components/chat-stream';
import { ProgressIngest } from '@/components/progress-ingest';

export default function ChatPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [ready, setReady] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [starters, setStarters] = useState<string[]>([]);

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
    <main className="min-h-screen p-4 bg-slate-50">
      {!ready && <ProgressIngest sessionId={sessionId} onReady={() => setReady(true)} />}
      {ready && <ChatStream sessionId={sessionId} greeting={greeting} starters={starters} />}
    </main>
  );
}
