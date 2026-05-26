'use client';
import { forwardRef, useImperativeHandle } from 'react';
import { useChat } from '@ai-sdk/react';
import { MessageBubble } from './message-bubble';
import { Markdown } from './markdown';
import { SoftCtaBanner } from './soft-cta-banner';
import { TypingIndicator } from './typing-indicator';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';

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

const chipBase =
  'inline-flex items-center rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-foreground transition-colors hover:bg-muted hover:border-foreground/20';

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

  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted';
  const isBusy = isStreaming || isSubmitted;
  const showIntro = messages.length === 0;

  const lastMsg = messages[messages.length - 1];
  const lastIsAssistant = lastMsg?.role === 'assistant';
  const suggestedReplies =
    !isBusy && lastIsAssistant
      ? extractSuggestedReplies(lastMsg.parts as MessagePart[] | undefined)
      : [];

  // Show typing indicator when waiting for first token, OR when streaming but
  // the latest assistant message has no text yet.
  const lastAssistantText = lastIsAssistant
    ? partsToText(lastMsg.parts as MessagePart[] | undefined)
    : '';
  const showTyping = isSubmitted || (isStreaming && lastAssistantText.length === 0);

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        {showIntro && greeting && (
          <MessageBubble role="assistant">
            <Markdown text={greeting} />
          </MessageBubble>
        )}
        {messages.map((m, idx) => {
          const text =
            typeof m.content === 'string' ? m.content : partsToText(m.parts as MessagePart[]);
          const role = m.role === 'user' ? 'user' : 'assistant';
          if (!text) return null;
          const isLastAssistant = role === 'assistant' && idx === messages.length - 1;
          return (
            <MessageBubble key={m.id} role={role}>
              {role === 'assistant' ? (
                <Markdown text={text} streaming={isStreaming && isLastAssistant} />
              ) : (
                <span className="whitespace-pre-wrap">{text}</span>
              )}
            </MessageBubble>
          );
        })}
        {showTyping && <TypingIndicator />}

        {suggestedReplies.length > 0 && (
          <div className="mb-4 ml-11 flex flex-wrap gap-2">
            {suggestedReplies.map((s, i) => (
              <button
                key={`${i}-${s}`}
                type="button"
                onClick={() => append({ role: 'user', content: s })}
                className={chipBase}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {messages.filter((m) => m.role === 'user').length >= 3 && (
        <div className="px-4">
          <SoftCtaBanner sessionId={sessionId} />
        </div>
      )}

      {showIntro && (
        <div className="space-y-3 px-4 pb-2">
          <Card className="border-l-[3px] border-l-primary">
            <button
              type="button"
              onClick={() => append({ role: 'user', content: FIT_ASSESSMENT_PROMPT })}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary text-base"
              >
                ⌖
              </span>
              <span className="flex flex-col">
                <span className="text-[15px] font-medium text-foreground">
                  Not sure what to ask?
                </span>
                <span className="text-sm text-muted-foreground">
                  Let me walk you through a fit assessment.
                </span>
              </span>
            </button>
          </Card>
          {starters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {starters.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => append({ role: 'user', content: s })}
                  className={chipBase}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="px-4 pb-4 pt-2">
        <div
          className={cn(
            'relative flex items-center rounded-xl border border-border bg-card shadow-sm',
            'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
            isBusy && 'opacity-60',
          )}
        >
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask anything about Dalgo…"
            className="flex-1 bg-transparent px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            disabled={isBusy}
          />
          <button
            type="submit"
            disabled={isBusy || !input.trim()}
            aria-label="Send"
            className={cn(
              'mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full',
              'bg-primary text-primary-foreground transition-opacity',
              'hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none',
            )}
          >
            {/* up-arrow icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
        <p className="ml-1 mt-1.5 text-xs text-muted-foreground">⏎ to send</p>
      </form>
    </div>
  );
});
