import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'ghost' | 'outline';
type Size = 'default' | 'sm' | 'icon';

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring',
  ghost:
    'bg-transparent text-foreground hover:bg-muted focus-visible:ring-ring',
  outline:
    'bg-transparent text-foreground border border-border hover:bg-muted focus-visible:ring-ring',
};

const sizeClasses: Record<Size, string> = {
  default: 'h-10 px-4 text-[15px] rounded-lg',
  sm: 'h-8 px-3 text-sm rounded-md',
  icon: 'h-8 w-8 rounded-full p-0',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'default', ...props },
  ref,
) {
  return (
    <button
      type="button"
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-50 disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
});
