'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { MessageBubble } from './message-bubble';
import { Markdown } from './markdown';
import { TypingIndicator } from './typing-indicator';
import { AssistantActions } from './assistant-actions';
import { cn } from '@/components/ui/cn';
import { FollowupOptin } from './followup-optin';
import { GuestAccessCard } from './guest-access-card';

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

function hasGuestTourOffer(parts: MessagePart[] | undefined): boolean {
  if (!parts) return false;
  return parts
    .filter((p): p is ToolInvocationPart => p.type === 'tool-invocation')
    .some((p) => p.toolInvocation?.toolName === 'offer_guest_tour');
}

export interface ChatStreamHandle {
  send: (text: string) => void;
}

const FIT_ASSESSMENT_PROMPT =
  "Walk me through a quick fit assessment — ask me one question at a time about our work, then give me your honest verdict on whether Dalgo fits us.";

const PROMPT_CARDS: Array<{ icon: string; title: string; sub: string; prompt: string }> = [
  {
    icon: '📊',
    title: 'What is Dalgo?',
    sub: 'A quick overview of the platform',
    prompt: 'Give me a short overview of what Dalgo is and what it does.',
  },
  {
    icon: '💰',
    title: 'Pricing for NGOs',
    sub: 'How costs scale with your org size',
    prompt: 'How is Dalgo priced for NGOs of different sizes?',
  },
  {
    icon: '🎯',
    title: 'Is Dalgo for us?',
    sub: '5-minute fit check',
    prompt: FIT_ASSESSMENT_PROMPT,
  },
  {
    icon: '🔌',
    title: 'Connect your data',
    sub: 'Which sources Dalgo supports',
    prompt: 'Which data sources does Dalgo connect to?',
  },
];

const chipBase =
  'inline-flex items-center rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-foreground transition-colors hover:bg-muted hover:border-foreground/20';

export interface InitialMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const ChatStream = forwardRef<
  ChatStreamHandle,
  {
    sessionId: string;
    isAdmin?: boolean;
    initialMessages?: InitialMessage[];
    email?: string | null;
    greeting?: string;
  }
>(function ChatStream({ sessionId, isAdmin, initialMessages, email, greeting }, ref) {
  const { messages, input, handleInputChange, handleSubmit, status, append } = useChat({
    api: '/api/chat',
    initialMessages,
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

  // (d) Auto-grow the input up to ~8 lines, then it scrolls internally.
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // (e) Keep the conversation pinned to the bottom while a reply streams in,
  // and jump to the bottom whenever a new message is added — unless the user
  // has deliberately scrolled up to read earlier history.
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const lastCountRef = useRef(0);
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (messages.length > lastCountRef.current) stickRef.current = true;
    lastCountRef.current = messages.length;
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const lastMsg = messages[messages.length - 1];
  const lastIsAssistant = lastMsg?.role === 'assistant';
  const suggestedReplies =
    !isBusy && lastIsAssistant
      ? extractSuggestedReplies(lastMsg.parts as MessagePart[] | undefined)
      : [];
  const showGuestTour =
    !isBusy && lastIsAssistant && hasGuestTourOffer(lastMsg.parts as MessagePart[] | undefined);

  const lastAssistantText = lastIsAssistant
    ? partsToText(lastMsg.parts as MessagePart[] | undefined)
    : '';
  const showTyping = isSubmitted || (isStreaming && lastAssistantText.length === 0);

  const findPrevUserText = (idx: number): string => {
    for (let i = idx - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'user') {
        const c = m.content;
        return typeof c === 'string' ? c : partsToText(m.parts as MessagePart[]);
      }
    }
    return '';
  };

  const promptCards = (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      {PROMPT_CARDS.map((card) => (
        <button
          key={card.title}
          type="button"
          onClick={() => append({ role: 'user', content: card.prompt })}
          className="rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-foreground/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="text-lg" aria-hidden>
            {card.icon}
          </span>
          <div className="mt-2 text-[15px] font-semibold text-foreground">{card.title}</div>
          <div className="mt-0.5 text-sm text-muted-foreground">{card.sub}</div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 pb-2">
        {showIntro ? (
          greeting ? (
            // First-visit greeting rendered as the bot's opening message,
            // with the starter prompt cards directly beneath it.
            <div className="flex flex-col pt-6 sm:pt-10">
              <MessageBubble role="assistant">
                <Markdown text={greeting} />
              </MessageBubble>
              <div className="mt-2">{promptCards}</div>
            </div>
          ) : (
            <div className="flex flex-col items-center pt-16 sm:pt-24">
              {/* Brand hero (fallback when no greeting is available) */}
              <span className="relative inline-flex h-12 w-12 items-center justify-center">
                <span aria-hidden className="absolute inset-0 rounded-full bg-primary/15" />
                <span aria-hidden className="relative h-9 w-9 rounded-full bg-primary" />
              </span>
              <h2 className="mt-4 text-center text-2xl font-medium tracking-tight text-foreground">
                How can Dalgo help your NGO today?
              </h2>
              <div className="mt-8">{promptCards}</div>
            </div>
          )
        ) : (
          <>
            {messages.map((m, idx) => {
              const text =
                typeof m.content === 'string' ? m.content : partsToText(m.parts as MessagePart[]);
              const role = m.role === 'user' ? 'user' : 'assistant';
              if (!text) return null;
              const isLastAssistant = role === 'assistant' && idx === messages.length - 1;
              return (
                <MessageBubble key={m.id} role={role}>
                  {role === 'assistant' ? (
                    <>
                      <Markdown text={text} streaming={isStreaming && isLastAssistant} />
                      {isAdmin && (
                        <AssistantActions
                          messageId={m.id}
                          userMsgText={findPrevUserText(idx)}
                          asstMsgText={text}
                        />
                      )}
                    </>
                  ) : (
                    <span className="whitespace-pre-wrap">{text}</span>
                  )}
                </MessageBubble>
              );
            })}
            {showTyping && <TypingIndicator />}

            {showGuestTour && (
              <div className="mb-4 ml-11 max-w-md">
                <GuestAccessCard />
              </div>
            )}

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
          </>
        )}
      </div>

      {/* Persistent follow-up opt-in — visible throughout the session until the
          user acts on it (FollowupOptin self-hides once opted-in or dismissed). */}
      <div className="px-4 lg:fixed lg:right-6 lg:top-28 lg:z-10 lg:w-72 lg:px-0">
        <FollowupOptin sessionId={sessionId} email={email} />
      </div>

      <form onSubmit={handleSubmit} className="px-4 pb-6 pt-2">
        <div
          className={cn(
            'relative flex items-end rounded-3xl border border-border bg-card shadow-sm transition-shadow',
            'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background hover:shadow-md',
            isBusy && 'opacity-60',
          )}
        >
          <textarea
            ref={taRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isBusy && input.trim()) e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            placeholder="Ask anything about Dalgo…"
            className="max-h-50 flex-1 resize-none overflow-y-auto bg-transparent px-5 py-3.5 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none"
            disabled={isBusy}
          />
          <button
            type="submit"
            disabled={isBusy || !input.trim()}
            aria-label="Send"
            className={cn(
              'mb-2 mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              'bg-primary text-primary-foreground transition-opacity',
              'hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none',
            )}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
        <div className="ml-1 mr-1 mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>⏎ to send · ⇧⏎ for a new line</span>
          <span>Powered by Anthropic</span>
        </div>
      </form>
    </div>
  );
});
