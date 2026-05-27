'use client';
import { useState } from 'react';
import { PromoteModal } from '@/components/admin/promote-modal';
import { RetrievalDebugPanel } from '@/components/admin/retrieval-debug-panel';
import { WrongAnswerModal } from '@/components/admin/wrong-answer-modal';

export function AssistantActions({
  messageId,
  userMsgText,
  asstMsgText,
}: {
  messageId: string;
  userMsgText: string;
  asstMsgText: string;
}) {
  const [openPromote, setOpenPromote] = useState(false);
  const [openDebug, setOpenDebug] = useState(false);
  const [openWrong, setOpenWrong] = useState(false);

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3 text-xs">
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => setOpenPromote(true)}
        >
          ↗ Promote to KB
        </button>
        <button
          type="button"
          className="text-muted-foreground hover:underline"
          onClick={() => setOpenDebug(true)}
        >
          👁 View retrieval debug
        </button>
        <button
          type="button"
          className="text-red-600 hover:underline"
          onClick={() => setOpenWrong(true)}
        >
          ⚠ This answer is wrong
        </button>
      </div>

      {openPromote && (
        <PromoteModal
          messageId={messageId}
          initialQuestion={userMsgText}
          initialAnswer={asstMsgText}
          onClose={() => setOpenPromote(false)}
        />
      )}
      {openDebug && (
        <RetrievalDebugPanel messageId={messageId} onClose={() => setOpenDebug(false)} />
      )}
      {openWrong && (
        <WrongAnswerModal messageId={messageId} onClose={() => setOpenWrong(false)} />
      )}
    </>
  );
}
