'use client';
import { useChat } from '@ai-sdk/react';
import { MessageBubble } from './message-bubble';

export function ChatStream({ sessionId }: { sessionId: string }) {
  const { messages, input, handleInputChange, handleSubmit, status } = useChat({
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

  return (
    <div className="flex flex-col h-[80vh] max-w-2xl mx-auto">
      <div className="flex-1 overflow-y-auto p-4">
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
