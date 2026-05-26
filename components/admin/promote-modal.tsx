'use client';
export function PromoteModal(props: {
  messageId: string;
  initialQuestion: string;
  initialAnswer: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded p-6 w-full max-w-lg">
        <p className="mb-2">PromoteModal — stub (Task 5)</p>
        <p className="text-xs text-slate-500 mb-4">messageId: {props.messageId}</p>
        <button className="px-3 py-1 border rounded" onClick={props.onClose}>Close</button>
      </div>
    </div>
  );
}
