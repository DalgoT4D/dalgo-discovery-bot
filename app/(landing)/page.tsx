'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmailModal } from '@/components/email-modal';
import { SiteHeader } from '@/components/site-header';

const LS_SESSION = 'dalgo_session_id';
const LS_EMAIL = 'dalgo_email';

export default function Landing() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(LS_SESSION) : null;
    if (saved) {
      router.replace(`/chat/${saved}`);
      return;
    }
    setHydrated(true);
    setShowModal(true);
  }, [router]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <SiteHeader variant="chat" />
      <main className="flex-1 overflow-hidden">
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
          <div className="flex-1" aria-hidden />
          <form className="px-4 pb-4 pt-2" aria-hidden onSubmit={(e) => e.preventDefault()}>
            <div className="relative flex items-center rounded-xl border border-border bg-card shadow-sm opacity-60">
              <input
                disabled
                placeholder="Ask anything about Dalgo…"
                className="flex-1 bg-transparent px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="button"
                disabled
                aria-label="Send"
                className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-40"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
            <p className="ml-1 mt-1.5 text-xs text-muted-foreground">⏎ to send</p>
          </form>
        </div>
      </main>
      {hydrated && showModal && (
        <EmailModal
          onSuccess={({ sessionId, email }) => {
            window.localStorage.setItem(LS_SESSION, sessionId);
            window.localStorage.setItem(LS_EMAIL, email);
            router.push(`/chat/${sessionId}`);
          }}
        />
      )}
    </div>
  );
}
