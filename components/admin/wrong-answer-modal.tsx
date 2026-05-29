'use client';
import { useState } from 'react';
import { KbEditor } from '@/components/admin/kb-editor';
import { Button } from '@/components/ui/button';
import type { Candidate } from '@/lib/admin/wrong-answer-types';

type Stage = 'reason' | 'pick' | 'edit' | 'no_trace';

export function WrongAnswerModal({
  messageId,
  onClose,
}: {
  messageId: string;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>('reason');
  const [reason, setReason] = useState('');
  const [reportId, setReportId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [chosen, setChosen] = useState<Candidate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitReason() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/wrong-answers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, reason }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setReportId(json.id);
      setCandidates(json.candidates);
      setStage(json.candidates.length === 0 ? 'no_trace' : 'pick');
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function patchFixed(kbId: string) {
    if (!reportId) return;
    const res = await fetch(`/api/admin/wrong-answers/${reportId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fixed_kb_id: kbId }),
    });
    if (!res.ok) {
      console.error('[WrongAnswerModal] patchFixed failed', res.status);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card text-card-foreground rounded-lg shadow-lg p-5 w-[90vw] max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-lg text-foreground">
            {stage === 'reason' && 'Report a wrong answer'}
            {stage === 'pick' && 'Pick the KB entry to fix'}
            {stage === 'edit' && 'Edit KB entry'}
            {stage === 'no_trace' && 'Report saved'}
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        {stage === 'reason' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              What was wrong about this answer? This will be saved for review and used to find the KB entry to fix.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The bot claimed Dalgo has RLS, but RLS is a Superset feature."
              rows={5}
              className="w-full border border-border rounded-md p-2 text-sm bg-card text-foreground"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={submitReason}
                disabled={reason.trim().length === 0 || submitting}
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </Button>
            </div>
          </div>
        )}

        {stage === 'pick' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              These KB entries were the top candidates that fed this answer. Pick the one that misled the bot, or skip if none apply.
            </p>
            <ul className="space-y-2">
              {candidates.map((c) => (
                <li key={c.kb_id}>
                  <button
                    type="button"
                    onClick={() => { setChosen(c); setStage('edit'); }}
                    className="w-full text-left border border-border rounded-md p-3 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium text-sm text-foreground">{c.question}</span>
                      <span className="text-xs text-muted-foreground">score {c.score.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.snippet}</div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onClose}>
                None of these — skip fix
              </Button>
            </div>
          </div>
        )}

        {stage === 'edit' && chosen && (
          <KbEditor
            id={chosen.kb_id}
            onSaved={async () => {
              await patchFixed(chosen.kb_id);
              onClose();
            }}
          />
        )}

        {stage === 'no_trace' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No retrieval trace is available for this message (it was sent before Phase 3 retrieval tracing). Your report has been saved but there's no candidate to fix inline.
            </p>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
