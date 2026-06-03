'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Draft = {
  category: string; question_variants: string[]; canonical_answer: string;
  status: 'yes' | 'partial' | 'no' | 'roadmap'; ngo_framing?: string | null;
  evidence?: string[]; notes_for_sales?: string | null;
};

export function WrongAnswerResolveModal({ reportId, onClose }: { reportId: number; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<'edit' | 'create'>('create');
  const [targetKbId, setTargetKbId] = useState<string | undefined>();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [addEval, setAddEval] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ fixed_kb_id: string; verified: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/wrong-answers/${reportId}/draft-fix`, { method: 'POST' });
      if (!res.ok) { setError(`Draft failed: HTTP ${res.status}`); setLoading(false); return; }
      const j = await res.json();
      setAction(j.action); setTargetKbId(j.target_kb_id);
      setDraft({ category: 'ai', ...j.draft }); setLoading(false);
    })();
  }, [reportId]);

  async function approve() {
    if (!draft) return;
    setBusy(true); setError(null);
    const payload = action === 'edit'
      ? { action: 'edit', target_kb_id: targetKbId, draft, add_eval_case: addEval }
      : { action: 'create', draft, add_eval_case: addEval };
    const res = await fetch(`/api/admin/wrong-answers/${reportId}/resolve`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { setError(`Approve failed: HTTP ${res.status}`); return; }
    setResult(await res.json());
  }

  async function dismiss() {
    setBusy(true);
    await fetch(`/api/admin/wrong-answers/${reportId}/resolve`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'dismiss' }) });
    setBusy(false); onClose();
  }

  function runEval() {
    window.open('/admin/evals', '_blank');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="max-h-[90vh] w-[90vw] max-w-2xl space-y-3 overflow-y-auto rounded-lg border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-foreground">Review &amp; fix</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {loading && <p className="text-sm text-muted-foreground">Drafting a fix…</p>}

        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              KB {action === 'edit' ? 'updated' : 'created'}. Retrieval re-check:{' '}
              {result.verified ? '✓ fixed entry now ranks top' : '⚠ fixed entry did not surface — review the entry'}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={runEval}>Run eval now</Button>
              <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : draft ? (
          <div className="space-y-3">
            <div className="flex gap-2 text-sm">
              <button onClick={() => setAction('create')} className={`rounded px-2 py-1 ${action === 'create' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>Create new</button>
              <button onClick={() => setAction('edit')} disabled={!targetKbId} className={`rounded px-2 py-1 ${action === 'edit' ? 'bg-primary text-primary-foreground' : 'bg-muted'} disabled:opacity-40`}>Edit existing</button>
            </div>
            <label className="block text-xs text-muted-foreground">Question variants (one per line)</label>
            <textarea rows={3} className="w-full rounded border border-border bg-card p-2 text-sm"
              value={draft.question_variants.join('\n')}
              onChange={(e) => setDraft({ ...draft, question_variants: e.target.value.split('\n').filter(Boolean) })} />
            <label className="block text-xs text-muted-foreground">Corrected answer</label>
            <textarea rows={6} className="w-full rounded border border-border bg-card p-2 text-sm"
              value={draft.canonical_answer} onChange={(e) => setDraft({ ...draft, canonical_answer: e.target.value })} />
            <label className="block text-xs text-muted-foreground">Status</label>
            <select className="rounded border border-border bg-card p-1 text-sm" value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft['status'] })}>
              {['yes', 'partial', 'no', 'roadmap'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={addEval} onChange={(e) => setAddEval(e.target.checked)} /> Add eval case (regression test)
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={dismiss} disabled={busy}>Dismiss (not wrong)</Button>
              <Button variant="primary" size="sm" onClick={approve} disabled={busy}>{busy ? 'Approving…' : 'Approve → update KB'}</Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
