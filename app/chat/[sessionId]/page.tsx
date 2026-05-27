'use client';
import { useRef } from 'react';
import { useParams } from 'next/navigation';
import { ChatStream, type ChatStreamHandle } from '@/components/chat-stream';
import { SiteHeader } from '@/components/site-header';

export default function ChatPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const chatRef = useRef<ChatStreamHandle>(null);

  return (
    <div className="flex h-screen flex-col bg-background">
      <SiteHeader variant="chat" sessionLive />
      <main className="flex-1 overflow-hidden">
        <ChatStream ref={chatRef} sessionId={sessionId} />
      </main>
    </div>
  );
}
