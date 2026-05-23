'use client';

import { useState } from 'react';
import useSWR from 'swr';

const fetcher = (u: string) => fetch(u).then((r) => r.json());

interface Category {
  key: string;
  label: string;
  icon: string;
  count: number;
  questions: { id: string; question: string; status: 'yes' | 'partial' | 'no' | 'roadmap' }[];
}

const STATUS_COLORS: Record<string, string> = {
  yes: 'text-green-600',
  partial: 'text-yellow-600',
  no: 'text-red-600',
  roadmap: 'text-blue-600',
};

const STATUS_LABEL: Record<string, string> = {
  yes: '✓',
  partial: '~',
  no: '✗',
  roadmap: '◔',
};

export function CategorySidebar({ onPick }: { onPick: (q: string) => void }) {
  const { data } = useSWR<{ categories: Category[] }>('/api/categories', fetcher);
  const [openKey, setOpenKey] = useState<string | null>('data_sources');

  if (!data) {
    return (
      <aside className="hidden lg:block w-72 border-r bg-slate-50 p-4 text-sm text-slate-500">
        Loading…
      </aside>
    );
  }

  return (
    <aside className="hidden lg:flex flex-col w-72 border-r bg-slate-50 overflow-y-auto">
      <div className="p-4 border-b sticky top-0 bg-slate-50 z-10">
        <h2 className="font-semibold text-slate-900">Explore Dalgo</h2>
        <p className="text-xs text-slate-500 mt-1">
          Browse capabilities. Click any question to ask the bot.
        </p>
      </div>

      <div className="p-2">
        {data.categories.map((c) => {
          const isOpen = openKey === c.key;
          return (
            <div key={c.key} className="mb-1">
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : c.key)}
                className="w-full flex items-center justify-between px-2 py-2 text-sm rounded hover:bg-slate-200 text-left"
              >
                <span className="flex items-center gap-2">
                  <span>{c.icon}</span>
                  <span className="font-medium text-slate-800">{c.label}</span>
                </span>
                <span className="text-xs text-slate-400">
                  {c.count} {isOpen ? '▾' : '▸'}
                </span>
              </button>

              {isOpen && (
                <ul className="mt-1 mb-2 space-y-0.5 pl-1">
                  {c.questions.map((q) => (
                    <li key={q.id}>
                      <button
                        type="button"
                        onClick={() => onPick(q.question)}
                        className="w-full text-left text-xs text-slate-700 hover:bg-white rounded px-2 py-1.5 leading-snug flex items-start gap-2"
                        title={q.question}
                      >
                        <span
                          className={`${STATUS_COLORS[q.status] ?? ''} font-mono text-[10px] mt-[2px]`}
                          aria-label={q.status}
                        >
                          {STATUS_LABEL[q.status] ?? '•'}
                        </span>
                        <span className="flex-1">{q.question}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-auto p-4 text-[10px] text-slate-400 border-t">
        <span className="text-green-600">✓</span> supported &nbsp;
        <span className="text-yellow-600">~</span> partial &nbsp;
        <span className="text-red-600">✗</span> not yet &nbsp;
        <span className="text-blue-600">◔</span> roadmap
      </div>
    </aside>
  );
}
