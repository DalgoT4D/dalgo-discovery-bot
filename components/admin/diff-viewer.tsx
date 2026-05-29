'use client';
import { diffLines } from 'diff';

export function DiffViewer({ oldText, newText }: { oldText: string; newText: string }) {
  const parts = diffLines(oldText, newText);
  return (
    <pre className="text-xs font-mono whitespace-pre-wrap border border-border rounded-md p-3 bg-muted max-h-[60vh] overflow-y-auto">
      {parts.map((p, i) => {
        const cls = p.added
          ? 'bg-green-100 text-green-900'
          : p.removed
            ? 'bg-red-100 text-red-900 line-through'
            : 'text-muted-foreground';
        return (
          <span key={i} className={cls}>
            {p.value}
          </span>
        );
      })}
    </pre>
  );
}
