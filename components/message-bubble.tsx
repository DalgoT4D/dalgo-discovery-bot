import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';

export function MessageBubble({
  role,
  children,
}: {
  role: 'user' | 'assistant';
  children: ReactNode;
}) {
  if (role === 'user') {
    return (
      <div className="my-6 flex flex-col items-end animate-in fade-in slide-in-from-bottom-1 duration-300">
        <p className="mb-1 mr-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          You
        </p>
        <div className="max-w-[75%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-primary-foreground">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="my-6 flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <Avatar fallback="●" />
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          Dalgo
        </p>
        <div className="max-w-[680px] text-[15px] leading-relaxed text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}
