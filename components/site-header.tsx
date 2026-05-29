import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from './ui/cn';

interface SiteHeaderProps {
  variant?: 'default' | 'chat';
  sessionLive?: boolean;
  right?: ReactNode;
  showAdminBadge?: boolean;
  adminEmail?: string;
}

export function SiteHeader({
  variant = 'default',
  sessionLive,
  right,
  showAdminBadge,
  adminEmail,
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-10 h-14 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
          <span className="font-semibold text-[17px] text-foreground">
            Dalgo{variant === 'chat' ? ' Discovery' : ''}
          </span>
          {showAdminBadge && (
            <Badge variant="outline" className="ml-2 text-[10px] tracking-wide">
              ADMIN
            </Badge>
          )}
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {right ?? (
            <>
              {variant === 'chat' && sessionLive && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={cn(
                      'inline-block h-1.5 w-1.5 rounded-full bg-primary',
                      'animate-pulse',
                    )}
                    aria-hidden
                  />
                  session live
                </span>
              )}
              {variant === 'chat' && adminEmail && (
                <span className="text-sm text-muted-foreground">{adminEmail}</span>
              )}
              {variant === 'default' && (
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  Privacy
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
