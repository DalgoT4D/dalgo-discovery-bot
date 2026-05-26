import Link from 'next/link';
import { query } from '@/lib/db/client';
import { PROMPT_SECTION_TITLES, PROMPT_SECTION_ORDER } from '@/lib/admin/prompt-sections';

type Row = {
  key: string;
  content: string;
  updated_by: string;
  updated_at: string;
};

export default async function PromptsListPage() {
  const { rows } = await query<Row>(
    `SELECT key, content, updated_by, updated_at FROM dalgo_prompts`,
  );
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const ordered = PROMPT_SECTION_ORDER.map((k) => byKey.get(k)).filter((r): r is Row => Boolean(r));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl">Prompts</h2>
        <p className="text-sm text-slate-500">
          Edit the bot's system prompt sections. Changes take effect on the next chat request (cached up to 60 seconds).
        </p>
      </div>
      <ul className="space-y-3">
        {ordered.map((p) => (
          <li
            key={p.key}
            className="border rounded p-4 bg-white hover:bg-slate-50"
          >
            <Link href={`/admin/prompts/${p.key}`} className="block space-y-2">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium text-slate-900">
                  {PROMPT_SECTION_TITLES[p.key] ?? p.key}
                </h3>
                <span className="text-xs text-slate-500">
                  {new Date(p.updated_at).toLocaleString()} · {p.updated_by}
                </span>
              </div>
              <p className="text-sm text-slate-600 line-clamp-2 font-mono">
                {p.content.slice(0, 200)}
                {p.content.length > 200 ? '…' : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
