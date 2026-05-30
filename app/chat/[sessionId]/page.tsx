'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChatStream, type ChatStreamHandle } from '@/components/chat-stream';
import { SiteHeader } from '@/components/site-header';

export default function ChatPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const chatRef = useRef<ChatStreamHandle>(null);

  // Admin status is bound to the SESSION (sessions.is_admin), not to the
  // browser's NextAuth cookie. Otherwise opening a guest chat in a tab where
  // admin is signed in elsewhere would wrongly show admin UI.
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/chat?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        setIsAdmin(Boolean(j.is_admin));
        setAdminEmail(j.is_admin ? (j.email ?? null) : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <SiteHeader
        variant="chat"
        sessionLive
        showAdminBadge={isAdmin}
        adminEmail={adminEmail ?? undefined}
      />
      <main className="flex-1 overflow-hidden">
        <ChatStream ref={chatRef} sessionId={sessionId} isAdmin={isAdmin} />
      </main>
    </div>
  );
}
