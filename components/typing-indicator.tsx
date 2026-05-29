import { Avatar } from '@/components/ui/avatar';

export function TypingIndicator() {
  return (
    <div className="my-6 flex gap-3 animate-in fade-in duration-300">
      <Avatar fallback="●" />
      <div className="flex flex-col">
        <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          Dalgo
        </p>
        <div className="flex items-center gap-1.5 h-6">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '200ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '400ms' }} />
        </div>
      </div>
    </div>
  );
}
