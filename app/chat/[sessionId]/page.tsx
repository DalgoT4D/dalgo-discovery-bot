'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChatStream, type ChatStreamHandle } from '@/components/chat-stream';
import { SiteHeader } from '@/components/site-header';

export default function ChatPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [greeting, setGreeting] = useState('');
  const [starters, setStarters] = useState<string[]>([]);
  const chatRef = useRef<ChatStreamHandle>(null);

  useEffect(() => {
    fetch(`/api/chat?session_id=${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        setGreeting(d.greeting ?? '');
        setStarters(d.starters ?? []);
      })
      .catch(() => {});
  }, [sessionId]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <SiteHeader variant="chat" sessionLive />
      <main className="flex-1 overflow-hidden">
        <ChatStream
          ref={chatRef}
          sessionId={sessionId}
          greeting={greeting}
          starters={starters}
        />
      </main>
    </div>
  );
}
