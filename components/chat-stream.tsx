'use client';
import { forwardRef, useImperativeHandle } from 'react';
import { useChat } from '@ai-sdk/react';
import { MessageBubble } from './message-bubble';
import { Markdown } from './markdown';
import { SoftCtaBanner } from './soft-cta-banner';

interface ToolInvocationPart {
  type: 'tool-invocation';
  toolInvocation?: {
    toolName?: string;
    args?: Record<string, unknown>;
    state?: 'partial-call' | 'call' | 'result';
  };
}
interface TextPart {
  type: 'text';
  text?: string;
}
type MessagePart = TextPart | ToolInvocationPart | { type: string };

function isTextPart(p: MessagePart): p is TextPart {
  return p.type === 'text';
}

function partsToText(parts: MessagePart[] | undefined): string {
  if (!parts) return '';
  return parts
    .filter(isTextPart)
    .map((p) => p.text ?? '')
    .join('');
}

function extractSuggestedReplies(parts: MessagePart[] | undefined): string[] {
  if (!parts) return [];
  const calls = parts
    .filter((p): p is ToolInvocationPart => p.type === 'tool-invocation')
    .filter((p) => p.toolInvocation?.toolName === 'suggest_replies')
    .map((p) => p.toolInvocation?.args);
  const last = calls[calls.length - 1] as { replies?: unknown } | undefined;
  if (!last || !Array.isArray(last.replies)) return [];
  return last.replies.filter((s): s is string => typeof s === 'string').slice(0, 4);
}

export interface ChatStreamHandle {
  send: (text: string) => void;
}

const FIT_ASSESSMENT_PROMPT =
  "Walk me through a quick fit assessment — ask me one question at a time about our work, then give me your honest verdict on whether Dalgo fits us.";

export const ChatStream = forwardRef<
  ChatStreamHandle,
  {
    sessionId: string;
    greeting?: string;
    starters?: string[];
  }
>(function ChatStream({ sessionId, greeting, starters = [] }, ref) {
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

  useImperativeHandle(
    ref,
    () => ({
      send: (text: string) => {
        if (!text.trim()) return;
        append({ role: 'user', content: text });
      },
    }),
    [append],
  );

  const isLoading = status === 'streaming' || status === 'submitted';
  const showIntro = messages.length === 0;

  // Show suggested-reply chips below the last assistant message (only when the
  // stream has settled and the user hasn't typed a follow-up yet).
  const lastMsg = messages[messages.length - 1];
  const suggestedReplies =
    !isLoading && lastMsg && lastMsg.role === 'assistant'
      ? extractSuggestedReplies(lastMsg.parts as MessagePart[] | undefined)
      : [];

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
      <div className="flex-1 overflow-y-auto p-4">
        {showIntro && greeting && (
          <MessageBubble role="assistant">
            <Markdown text={greeting} />
          </MessageBubble>
        )}
        {messages.map((m) => {
          const text = typeof m.content === 'string' ? m.content : partsToText(m.parts as MessagePart[]);
          const role = m.role === 'user' ? 'user' : 'assistant';
          if (!text) return null;
          return (
            <MessageBubble key={m.id} role={role}>
              {role === 'assistant' ? (
                <Markdown text={text} />
              ) : (
                <span className="whitespace-pre-wrap">{text}</span>
              )}
            </MessageBubble>
          );
        })}
        {isLoading && <p className="text-sm text-slate-500 pl-2">…</p>}

        {/* Suggested follow-up chips under the latest assistant reply */}
        {suggestedReplies.length > 0 && (
          <div className="mt-2 pl-2 flex flex-wrap gap-2">
            {suggestedReplies.map((s, i) => (
              <button
                key={`${i}-${s}`}
                type="button"
                onClick={() => append({ role: 'user', content: s })}
                className="text-sm bg-white border border-slate-300 rounded-full px-3 py-1 hover:bg-slate-100 hover:border-slate-400 transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {messages.filter((m) => m.role === 'user').length >= 3 && (
        <SoftCtaBanner sessionId={sessionId} />
      )}

      {showIntro && (
        <div className="px-4 pb-2 space-y-2">
          <div>
            <button
              type="button"
              onClick={() => append({ role: 'user', content: FIT_ASSESSMENT_PROMPT })}
              className="w-full text-sm bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-4 py-2 hover:bg-amber-100 font-medium text-left flex items-center gap-2"
            >
              <span>🎯</span>
              <span>Not sure what to ask? Let me walk you through a fit assessment</span>
            </button>
          </div>
          {starters.length > 0 && (
            <div className="flex flex-wrap gap-2">
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
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t bg-white p-3 flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask anything about Dalgo…"
          className="flex-1 border rounded p-2"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-slate-900 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
});
