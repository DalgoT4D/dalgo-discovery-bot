'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChatStream, type ChatStreamHandle, type InitialMessage } from '@/components/chat-stream';
import { SiteHeader } from '@/components/site-header';
import { GuestAccessButton } from '@/components/guest-access-button';

interface MetaResponse {
  is_admin?: boolean;
  email?: string | null;
  initial_messages?: InitialMessage[];
  greeting?: string;
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

  // The admin BADGE is driven by sessions.is_admin (in DB), but admin-only
  // ACTIONS still require an active NextAuth session. When those fall out
  // of sync — chat session marked admin, but NextAuth cookie missing /
  // expired — admin actions silently 401. Surface a re-sign-in CTA up front
  // so the user knows what to do instead of discovering it via a broken
  // button click.
  const { status: authStatus } = useSession();
  const needsResignin = isAdmin && authStatus === 'unauthenticated';
  const signinHref = `/signin?callbackUrl=${encodeURIComponent(`/chat/${sessionId}`)}`;

  return (
    <div className="flex h-screen flex-col bg-background">
      <SiteHeader
        variant="chat"
        showAdminBadge={isAdmin}
        right={
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:inline-flex">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
              session live
            </span>
            {adminEmail && (
              <span className="hidden text-sm text-muted-foreground sm:inline">{adminEmail}</span>
            )}
            <GuestAccessButton />
          </div>
        }
      />
      {needsResignin && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span className="font-medium">Admin session expired.</span> You can still chat, but
          admin actions (report wrong answer, view retrieval debug, promote to KB) need a fresh sign-in.{' '}
          <a href={signinHref} className="underline font-medium">
            Sign in again →
          </a>
        </div>
      )}
      <main className="flex-1 overflow-hidden">
        {meta !== null && (
          <ChatStream
            ref={chatRef}
            sessionId={sessionId}
            isAdmin={isAdmin}
            initialMessages={meta.initial_messages ?? []}
            email={meta?.email}
            greeting={meta?.greeting}
          />
        )}
      </main>
    </div>
  );
}
