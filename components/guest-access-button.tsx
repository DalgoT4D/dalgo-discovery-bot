'use client';
import { useEffect, useRef, useState } from 'react';
import { GuestAccessCard } from './guest-access-card';

/**
 * Always-visible header affordance: a small "Try the platform" button that
 * toggles a popover containing the GuestAccessCard. Closes on outside-click or
 * Escape. No external dependency — lightweight popover.
 */
export function GuestAccessButton() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
      >
        🚀 Try the platform
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw]">
          <GuestAccessCard className="shadow-xl" />
        </div>
      )}
    </div>
  );
}
