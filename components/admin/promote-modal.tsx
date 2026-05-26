'use client';
import { useState } from 'react';

interface Props {
  messageId: string;
  initialQuestion: string;
  initialAnswer: string;
  onClose: () => void;
  source?: 'promoted_from_conversation' | 'promoted_from_unanswered';
}

const CATEGORIES = [
  'data_sources','transforms','dashboards','orchestration',
  'ai','sharing','rbac','security','deployment',
  'pricing','mission','stack','limitations','case_studies',
];

export function PromoteModal({ messageId, initialQuestion, initialAnswer, onClose, source }: Props) {
  const [questionVariants, setQuestionVariants] = useState(initialQuestion);
  const [answer, setAnswer] = useState(initialAnswer);
  const [category, setCategory] = useState('case_studies');
  const [status, setStatus] = useState<'yes' | 'partial' | 'no' | 'roadmap'>('yes');
  const [evidence, setEvidence] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await fetch('/api/admin/kb/from-message', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        questionVariants: questionVariants.split('\n').map((s) => s.trim()).filter(Boolean),
        canonicalAnswer: answer,
        category,
        status,
        evidence: evidence.split('\n').map((s) => s.trim()).filter(Boolean),
        sourceMessageId: messageId,
        source: source ?? 'promoted_from_conversation',
      }),
    });
    setSaving(false);
    if (res.ok) {
      onClose();
      alert('Promoted to KB');
    } else {
      const j = await res.json().catch(() => ({}));
      alert(`Failed: ${j.error ?? res.statusText}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl space-y-4">
        <h3 className="text-lg font-semibold">Promote to KB</h3>

        <label className="block">
          <div className="text-sm font-medium">Question (one phrasing per line)</div>
          <textarea
            className="w-full border rounded p-2 mt-1"
            rows={3}
            value={questionVariants}
            onChange={(e) => setQuestionVariants(e.target.value)}
          />
        </label>

        <label className="block">
          <div className="text-sm font-medium">Canonical answer</div>
          <textarea
            className="w-full border rounded p-2 mt-1"
            rows={6}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="text-sm font-medium">Category</div>
            <select
              className="w-full border rounded p-2 mt-1"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-sm font-medium">Status</div>
            <select
              className="w-full border rounded p-2 mt-1"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="yes">yes</option>
              <option value="partial">partial</option>
              <option value="no">no</option>
              <option value="roadmap">roadmap</option>
            </select>
          </label>
        </div>

        <label className="block">
          <div className="text-sm font-medium">Evidence URLs (one per line)</div>
          <textarea
            className="w-full border rounded p-2 mt-1"
            rows={2}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button className="px-4 py-2 border rounded" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save to KB'}
          </button>
        </div>
      </div>
    </div>
  );
}
