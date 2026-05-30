'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChatStream, type ChatStreamHandle, type InitialMessage } from '@/components/chat-stream';
import { SiteHeader } from '@/components/site-header';

interface MetaResponse {
  is_admin?: boolean;
  email?: string | null;
  initial_messages?: InitialMessage[];
}

export default function ChatPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const chatRef = useRef<ChatStreamHandle>(null);

  // Both admin status AND prior message history live in the SESSION (not
  // the browser cookie / not localStorage). We fetch once before mounting
  // ChatStream so useChat's initialMessages hydrates correctly and we
  // don't flash the empty-state intro for returning users.
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/chat?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        setMeta(j);
      })
      .catch(() => {
        if (!cancelled) setMeta({});
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const isAdmin = Boolean(meta?.is_admin);
  const adminEmail = isAdmin ? (meta?.email ?? null) : null;

  return (
    <div className="flex h-screen flex-col bg-background">
      <SiteHeader
        variant="chat"
        sessionLive
        showAdminBadge={isAdmin}
        adminEmail={adminEmail ?? undefined}
      />
      <main className="flex-1 overflow-hidden">
        {meta !== null && (
          <ChatStream
            ref={chatRef}
            sessionId={sessionId}
            isAdmin={isAdmin}
            initialMessages={meta.initial_messages ?? []}
          />
        )}
      </main>
    </div>
  );
}
