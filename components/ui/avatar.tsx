import type { ReactNode } from 'react';
import { cn } from './cn';

export function Avatar({
  fallback,
  size = 32,
  className,
}: {
  fallback: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary text-sm font-semibold',
        className,
      )}
    >
      {fallback}
    </span>
  );
}
