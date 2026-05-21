'use client';
import { useChat } from '@ai-sdk/react';
import { MessageBubble } from './message-bubble';

export function ChatStream({
  sessionId,
  greeting,
  starters = [],
}: {
  sessionId: string;
  greeting?: string;
  starters?: string[];
}) {
  const { messages, input, handleInputChange, handleSubmit, status, append } = useChat({
    api: '/api/chat',
    experimental_prepareRequestBody: ({ messages }) => {
      const last = messages[messages.length - 1];
      const text =
        typeof last?.content === 'string'
          ? last.content
          : (last?.parts?.find((p) => p.type === 'text')?.text ?? '');
      return { session_id: sessionId, message: text };
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';
  const showIntro = messages.length === 0;

  return (
    <div className="flex flex-col h-[80vh] max-w-2xl mx-auto">
      <div className="flex-1 overflow-y-auto p-4">
        {showIntro && greeting && (
          <MessageBubble role="assistant">
            <span>{greeting}</span>
          </MessageBubble>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role === 'user' ? 'user' : 'assistant'}>
            {typeof m.content === 'string' ? (
              <span>{m.content}</span>
            ) : (
              m.parts?.map((p, i) =>
                p.type === 'text' ? <span key={i}>{p.text}</span> : null,
              )
            )}
          </MessageBubble>
        ))}
        {isLoading && <p className="text-sm text-slate-500">…</p>}
      </div>

      {showIntro && starters.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-2">
          {starters.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => append({ role: 'user', content: s })}
              className="text-sm border border-slate-300 rounded-full px-3 py-1 hover:bg-slate-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t p-3 flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask anything about Dalgo…"
          className="flex-1 border rounded p-2"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-slate-900 text-white px-3 py-2 rounded"
        >
          Send
        </button>
      </form>
    </div>
  );
}
