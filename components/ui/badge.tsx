import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'default' | 'primary' | 'outline';

const variantClasses: Record<Variant, string> = {
  default: 'bg-muted text-foreground',
  primary: 'bg-primary text-primary-foreground',
  outline: 'border border-border text-foreground',
};

export function Badge({
  variant = 'default',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
