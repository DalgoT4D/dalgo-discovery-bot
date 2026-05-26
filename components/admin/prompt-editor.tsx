'use client';
import { useEffect, useState } from 'react';
import { DiffViewer } from '@/components/admin/diff-viewer';

type Prompt = {
  key: string;
  content: string;
  updated_by: string;
  updated_at: string;
};

type Version = {
  id: number;
  prompt_key: string;
  content: string;
  updated_by: string;
  updated_at: string;
};

export function PromptEditor({ promptKey }: { promptKey: string }) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [draft, setDraft] = useState('');
  const [versions, setVersions] = useState<Version[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [diffWith, setDiffWith] = useState<Version | null>(null);

  async function reload() {
    const [p, v] = await Promise.all([
      fetch(`/api/admin/prompts/${promptKey}`).then((r) => r.json()),
      fetch(`/api/admin/prompts/${promptKey}/versions`).then((r) => r.json()),
    ]);
    setPrompt(p.item);
    setDraft(p.item.content);
    setVersions(v.versions);
  }

  useEffect(() => {
    reload();
  }, [promptKey]);

  async function save() {
    if (!prompt) return;
    setSaving(true);
    const res = await fetch(`/api/admin/prompts/${promptKey}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: draft }),
    });
    setSaving(false);
    if (res.ok) {
      setToast('Saved. Takes effect within 60 seconds.');
      await reload();
      setTimeout(() => setToast(null), 4000);
    } else {
      setToast('Save failed.');
      setTimeout(() => setToast(null), 4000);
    }
  }

  if (!prompt) return <p>Loading…</p>;
  const dirty = draft !== prompt.content;

  return (
    <div className="grid grid-cols-[1fr_22rem] gap-6">
      {/* Editor */}
      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full font-mono text-sm border rounded p-3 min-h-[60vh] resize-y"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="bg-slate-900 text-white px-4 py-2 rounded disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setDraft(prompt.content)}
            disabled={!dirty || saving}
            className="border px-4 py-2 rounded disabled:opacity-40"
          >
            Cancel
          </button>
          {toast && <span className="text-sm text-slate-600 ml-2">{toast}</span>}
        </div>
      </div>

      {/* Version history */}
      <aside className="space-y-2">
        <h3 className="font-medium text-slate-900">Version history</h3>
        <ul className="space-y-1 max-h-[60vh] overflow-y-auto border rounded">
          {versions.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setDiffWith(v)}
                className="w-full text-left text-xs p-2 hover:bg-slate-50 border-b last:border-b-0"
              >
                <div>{new Date(v.updated_at).toLocaleString()}</div>
                <div className="text-slate-500">{v.updated_by}</div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Diff modal */}
      {diffWith && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-40"
          onClick={() => setDiffWith(null)}
        >
          <div
            className="bg-white rounded shadow-lg p-4 w-[90vw] max-w-3xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-medium">
                Diff: {new Date(diffWith.updated_at).toLocaleString()} → current
              </h4>
              <button
                type="button"
                onClick={() => setDiffWith(null)}
                className="text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>
            </div>
            <DiffViewer oldText={diffWith.content} newText={prompt.content} />
            <p className="text-xs text-slate-500">
              No restore button — copy any blocks you want from the diff into the editor manually.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
