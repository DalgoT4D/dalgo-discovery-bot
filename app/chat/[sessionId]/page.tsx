'use client';
import { useRef } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChatStream, type ChatStreamHandle } from '@/components/chat-stream';
import { SiteHeader } from '@/components/site-header';

export default function ChatPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const chatRef = useRef<ChatStreamHandle>(null);
  const { data: session, status } = useSession();
  const isAdmin = status === 'authenticated' && !!session?.user?.email;

  return (
    <div className="flex h-screen flex-col bg-background">
      <SiteHeader
        variant="chat"
        sessionLive
        showAdminBadge={isAdmin}
        adminEmail={isAdmin ? (session?.user?.email ?? undefined) : undefined}
      />
      <main className="flex-1 overflow-hidden">
        <ChatStream ref={chatRef} sessionId={sessionId} isAdmin={isAdmin} />
      </main>
    </div>
  );
}
