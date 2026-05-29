'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Proposal {
  question: string;
  variants: string[];
  answer: string;
  status: 'yes' | 'partial' | 'no' | 'roadmap';
  evidence: string[];
  selected: boolean;
}

const CATEGORIES = [
  'data_sources',
  'transforms',
  'dashboards',
  'orchestration',
  'ai',
  'sharing',
  'rbac',
  'security',
  'deployment',
  'pricing',
  'mission',
  'stack',
  'limitations',
  'case_studies',
];

export function KbImport() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [category, setCategory] = useState('limitations');
  const [extracting, setExtracting] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function extract() {
    setExtracting(true);
    setError(null);
    setProposals([]);
    const res = await fetch('/api/admin/kb/extract-qa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, category }),
    });
    setExtracting(false);
    if (!res.ok) {
      setError(`HTTP ${res.status}`);
      return;
    }
    const { pairs } = await res.json();
    setProposals(pairs.map((p: Omit<Proposal, 'selected'>) => ({ ...p, selected: true })));
  }

  function patchProposal(idx: number, patch: Partial<Proposal>) {
    setProposals((curr) => curr.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function discardProposal(idx: number) {
    setProposals((curr) => curr.filter((_, i) => i !== idx));
  }

  async function saveAll() {
    setSaving(true);
    setError(null);
    const approved = proposals.filter((p) => p.selected);
    let created = 0;
    for (const p of approved) {
      const res = await fetch('/api/admin/kb', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category,
          question_variants: [p.question, ...(p.variants ?? [])],
          canonical_answer: p.answer,
          status: p.status,
          evidence: p.evidence,
        }),
      });
      if (res.ok) created++;
    }
    setSaving(false);
    if (created === 0) {
      setError('Nothing was created.');
      return;
    }
    router.push('/admin/kb');
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <section>
        <h2 className="text-lg font-semibold mb-2">1. Paste source content</h2>
        <label className="block mb-2">
          <span className="text-sm font-medium">Category</span>
          <select
            className="border border-border bg-background rounded p-2 ml-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <textarea
          className="w-full min-h-[180px] border border-border bg-background rounded p-3 font-mono text-sm"
          placeholder="Paste short factual content or a longer doc section (~200-1500 words)…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={extract}
          disabled={extracting || text.trim().length < 30}
          className="mt-3 bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 disabled:opacity-50"
        >
          {extracting ? 'Extracting Q&A…' : 'Suggest Q&A entries'}
        </button>
      </section>

      {error && <p className="text-destructive">Error: {error}</p>}

      {proposals.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">
            2. Review proposed entries ({proposals.length})
          </h2>
          <div className="space-y-4">
            {proposals.map((p, idx) => (
              <div
                key={idx}
                className={`border rounded p-4 ${p.selected ? 'border-border bg-background' : 'border-border bg-muted opacity-60'}`}
              >
                <label className="flex gap-2 items-start mb-2">
                  <input
                    type="checkbox"
                    checked={p.selected}
                    onChange={(e) => patchProposal(idx, { selected: e.target.checked })}
                    className="mt-1"
                  />
                  <input
                    className="flex-1 border border-border bg-background rounded p-2 font-semibold"
                    value={p.question}
                    onChange={(e) => patchProposal(idx, { question: e.target.value })}
                  />
                </label>
                <textarea
                  className="w-full border border-border bg-background rounded p-2 mb-2 text-sm"
                  value={p.answer}
                  onChange={(e) => patchProposal(idx, { answer: e.target.value })}
                  rows={3}
                />
                <div className="flex items-center gap-3 text-sm">
                  <label>
                    Status:
                    <select
                      className="border border-border bg-background rounded p-1 ml-1"
                      value={p.status}
                      onChange={(e) =>
                        patchProposal(idx, { status: e.target.value as Proposal['status'] })
                      }
                    >
                      <option value="yes">yes</option>
                      <option value="partial">partial</option>
                      <option value="no">no</option>
                      <option value="roadmap">roadmap</option>
                    </select>
                  </label>
                  <span className="text-muted-foreground">Variants: {p.variants.join(', ')}</span>
                  <button
                    onClick={() => discardProposal(idx)}
                    className="ml-auto text-destructive hover:underline"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={saveAll}
            disabled={saving || proposals.filter((p) => p.selected).length === 0}
            className="mt-4 bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : `Save ${proposals.filter((p) => p.selected).length} selected to KB`}
          </button>
        </section>
      )}
    </div>
  );
}
