'use client';
export function RetrievalDebugPanel(props: { messageId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-white border-l shadow-xl p-4">
      <div className="flex justify-between mb-3">
        <h3 className="text-lg font-semibold">Retrieval debug — stub (Task 6)</h3>
        <button onClick={props.onClose} className="text-slate-500">✕</button>
      </div>
      <p className="text-xs">messageId: {props.messageId}</p>
    </div>
  );
}
