'use client';
import useSWR from 'swr';

interface Props {
  messageId: string;
  onClose: () => void;
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function RetrievalDebugPanel({ messageId, onClose }: Props) {
  const { data } = useSWR<{ trace: any }>(
    `/api/admin/messages/${messageId}/retrieval`,
    fetcher,
  );
  const t = data?.trace;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-card text-card-foreground border-l border-border shadow-xl p-4 overflow-y-auto z-50">
      <div className="flex justify-between mb-3">
        <h3 className="text-lg font-semibold text-foreground">Retrieval debug</h3>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>
      </div>

      {!t && <div>Loading…</div>}

      {t && (
        <div className="text-xs space-y-4">
          <section>
            <h4 className="font-semibold mb-1 text-foreground">HyDE rewrites</h4>
            <div className="space-y-1">
              <div><span className="text-muted-foreground">problem:</span> {t.hyde.problem_query}</div>
              <div><span className="text-muted-foreground">capability:</span> {t.hyde.capability_query}</div>
              <div><span className="text-muted-foreground">evidence:</span> {t.hyde.evidence_query}</div>
            </div>
          </section>

          <section>
            <h4 className="font-semibold mb-1 text-foreground">Fused top 12</h4>
            <ol className="space-y-1">
              {(t.fused_top12 ?? []).map((c: any, i: number) => (
                <li key={c.id} className="border border-border rounded p-2">
                  <div className="text-muted-foreground">#{i + 1} · {c.source} · score {c.score.toFixed(3)}</div>
                  <div>{c.preview}</div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h4 className="font-semibold mb-1 text-foreground">Rerank scores</h4>
            <ul className="space-y-1">
              {(t.rerank_scores ?? []).map((r: any) => (
                <li key={r.id}>{r.id}: <strong>{r.score}</strong></li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="font-semibold mb-1 text-foreground">Final context (top 5)</h4>
            <ul className="space-y-1">
              {(t.final_context_ids ?? []).map((id: string) => <li key={id}>{id}</li>)}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
