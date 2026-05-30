'use client';
import { useCallback, useEffect, useState } from 'react';
import { DiffViewer } from '@/components/admin/diff-viewer';
import { Button } from '@/components/ui/button';

type Prompt = {
  key: string;
  content: string;
  updated_by: string;
  updated_at: string;
  read_only?: boolean;
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

  const reload = useCallback(async () => {
    const [pr, vr] = await Promise.all([
      fetch(`/api/admin/prompts/${promptKey}`),
      fetch(`/api/admin/prompts/${promptKey}/versions`),
    ]);
    if (!pr.ok) {
      console.error('[PromptEditor] failed to load prompt', promptKey, pr.status);
      return;
    }
    const [p, v] = await Promise.all([pr.json(), vr.ok ? vr.json() : Promise.resolve({ versions: [] })]);
    setPrompt(p.item);
    setDraft(p.item.content);
    setVersions(v.versions ?? []);
  }, [promptKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  useEffect(() => {
    if (!diffWith) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDiffWith(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [diffWith]);

  async function save() {
    if (!prompt) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/prompts/${promptKey}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: draft }),
      });
      if (res.ok) {
        setToast('Saved. Takes effect within 60 seconds.');
        await reload();
      } else {
        setToast('Save failed.');
      }
    } catch {
      setToast('Save failed.');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  if (!prompt) return <p>Loading…</p>;
  const dirty = draft !== prompt.content;

  if (prompt.read_only) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Auto-generated — read-only</p>
          <p className="mt-1">
            This section is derived from the tools registered in <code className="font-mono">lib/llm/tools/</code>.
            To change it, add/remove/rename a tool in code; the section updates on the next chat request.
          </p>
        </div>
        <textarea
          value={prompt.content}
          readOnly
          className="w-full font-mono text-sm border border-border rounded-md p-3 min-h-[40vh] resize-y bg-muted text-foreground cursor-not-allowed"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_22rem] gap-6">
      {/* Editor */}
      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full font-mono text-sm border border-border rounded-md p-3 min-h-[60vh] resize-y bg-card text-foreground"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={save}
            disabled={!dirty || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setDraft(prompt.content)}
            disabled={!dirty || saving}
          >
            Cancel
          </Button>
          {toast && <span className="text-sm text-muted-foreground ml-2">{toast}</span>}
        </div>
      </div>

      {/* Version history */}
      <aside className="space-y-2">
        <h3 className="font-medium text-foreground">Version history</h3>
        <ul className="space-y-1 max-h-[60vh] overflow-y-auto border border-border rounded-md">
          {versions.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setDiffWith(v)}
                className="w-full text-left text-xs p-2 hover:bg-muted border-b border-border last:border-b-0 transition-colors"
              >
                <div className="text-foreground">{new Date(v.updated_at).toLocaleString()}</div>
                <div className="text-muted-foreground">{v.updated_by}</div>
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
            className="bg-card text-card-foreground rounded-lg shadow-lg p-4 w-[90vw] max-w-3xl space-y-3 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-foreground">
                Diff: {new Date(diffWith.updated_at).toLocaleString()} → current
              </h4>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setDiffWith(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>
            <DiffViewer oldText={diffWith.content} newText={prompt.content} />
            <p className="text-xs text-muted-foreground">
              No restore button — copy any blocks you want from the diff into the editor manually.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
