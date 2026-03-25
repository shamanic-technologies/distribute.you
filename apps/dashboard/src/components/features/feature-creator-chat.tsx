"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type FormEvent,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { useBillingGuard } from "@/lib/billing-guard";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronRightIcon,
  WrenchScrewdriverIcon,
  SparklesIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  XCircleIcon,
  ArrowUpIcon,
  StopIcon,
} from "@heroicons/react/20/solid";
import type { FeatureDraft } from "./feature-builder-panel";

/* ─── LocalStorage persistence ───────────────────────────────────── */

const STORAGE_PREFIX = "feature-creator-chat";

function loadSessionId(id: string): string | null {
  try { return localStorage.getItem(`${STORAGE_PREFIX}-session:${id}`); } catch { return null; }
}
function saveSessionId(id: string, sessionId: string) {
  try { localStorage.setItem(`${STORAGE_PREFIX}-session:${id}`, sessionId); } catch { /* */ }
}
function loadMessages(id: string): UIMessage[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}-msgs:${id}`);
    return raw ? (JSON.parse(raw) as UIMessage[]) : [];
  } catch { return []; }
}
function saveMessages(id: string, messages: UIMessage[]) {
  try { localStorage.setItem(`${STORAGE_PREFIX}-msgs:${id}`, JSON.stringify(messages)); } catch { /* */ }
}
function clearChat(id: string) {
  localStorage.removeItem(`${STORAGE_PREFIX}-session:${id}`);
  localStorage.removeItem(`${STORAGE_PREFIX}-msgs:${id}`);
}

/* ─── Collapsible ────────────────────────────────────────────────── */

function Collapsible({
  label,
  icon,
  statusIcon,
  isStreaming,
  defaultOpen = false,
  variant = "default",
  children,
}: {
  label: string;
  icon: React.ReactNode;
  statusIcon?: React.ReactNode;
  isStreaming?: boolean;
  defaultOpen?: boolean;
  variant?: "default" | "thinking" | "error";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const styles = {
    default: "bg-gray-50/80 dark:bg-white/[0.04] border-gray-200/60 dark:border-white/[0.08] text-gray-600 dark:text-gray-300",
    thinking: "bg-amber-50/50 dark:bg-amber-500/[0.06] border-amber-200/50 dark:border-amber-400/[0.12] text-amber-700 dark:text-amber-300",
    error: "bg-red-50/50 dark:bg-red-500/[0.06] border-red-200/50 dark:border-red-400/[0.12] text-red-700 dark:text-red-300",
  };

  return (
    <div className={`my-2 rounded-xl border ${styles[variant]} overflow-hidden transition-colors`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium hover:opacity-80 transition-opacity"
      >
        <ChevronRightIcon className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        {icon}
        <span className="truncate">{label}</span>
        <span className="ml-auto flex items-center gap-1">
          {isStreaming ? (
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          ) : statusIcon ?? null}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-xs whitespace-pre-wrap break-words max-h-64 overflow-y-auto border-t border-inherit">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── JSON renderer ──────────────────────────────────────────────── */

function PrettyJSON({ value }: { value: string }) {
  let formatted: string;
  try { formatted = JSON.stringify(JSON.parse(value), null, 2); } catch { formatted = value; }
  return (
    <pre className="bg-gray-900/[0.04] dark:bg-white/[0.04] rounded-lg p-2.5 overflow-x-auto text-[11px] leading-relaxed font-mono text-gray-700 dark:text-gray-300 border border-gray-200/40 dark:border-white/[0.06]">
      {formatted}
    </pre>
  );
}

/* ─── Thinking block ─────────────────────────────────────────────── */

function ThinkingBlockUI({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  return (
    <Collapsible
      label={isStreaming ? "Thinking..." : "Thought process"}
      icon={<SparklesIcon className="w-3.5 h-3.5 flex-shrink-0" />}
      statusIcon={!isStreaming ? <CheckCircleIcon className="w-3.5 h-3.5 opacity-50" /> : undefined}
      isStreaming={isStreaming}
      variant="thinking"
      defaultOpen
    >
      <div className="leading-relaxed opacity-70">
        {text ? <TextContent text={text} /> : <p>...</p>}
      </div>
    </Collapsible>
  );
}

/* ─── Tool invocation block ──────────────────────────────────────── */

function ToolInvocationUI({ part }: { part: { type: string; toolCallId: string; toolName?: string; state: string; input?: unknown; output?: unknown } }) {
  const name = (part.toolName ?? (part.type.startsWith("tool-") ? part.type.slice(5) : "unknown"))
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const isWaiting = part.state === "input-streaming" || part.state === "input-available";
  const hasResult = part.state === "output-available";

  let isError = false;
  if (hasResult && part.output) {
    try {
      const parsed = typeof part.output === "string" ? JSON.parse(part.output) : part.output;
      isError = parsed.success === false || !!parsed.error;
    } catch { /* */ }
  }

  const argsStr = typeof part.input === "string" ? part.input : JSON.stringify(part.input ?? {});
  const resultStr = typeof part.output === "string" ? part.output : JSON.stringify(part.output ?? "");

  return (
    <Collapsible
      label={isWaiting ? `Calling ${name}...` : `Called ${name}`}
      icon={isWaiting ? <ArrowPathIcon className="w-3.5 h-3.5 flex-shrink-0 animate-spin" /> : <WrenchScrewdriverIcon className="w-3.5 h-3.5 flex-shrink-0" />}
      statusIcon={hasResult ? (isError ? <XCircleIcon className="w-3.5 h-3.5 text-red-500/70" /> : <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500/70" />) : undefined}
      isStreaming={isWaiting}
      variant={isError ? "error" : "default"}
    >
      <div className="space-y-2.5">
        {argsStr && argsStr !== "{}" && (
          <div>
            <span className="font-semibold opacity-50 block mb-1 uppercase tracking-wider text-[10px]">Input</span>
            <PrettyJSON value={argsStr} />
          </div>
        )}
        {hasResult && (
          <div>
            <span className="font-semibold opacity-50 block mb-1 uppercase tracking-wider text-[10px]">Result</span>
            <div className="max-h-40 overflow-y-auto"><PrettyJSON value={resultStr} /></div>
          </div>
        )}
        {isWaiting && <p className="opacity-40 italic text-[11px]">Waiting for result...</p>}
      </div>
    </Collapsible>
  );
}

/* ─── Markdown ───────────────────────────────────────────────────── */

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="bg-gray-100 dark:bg-white/[0.08] text-gray-800 dark:text-gray-200 rounded px-1 py-0.5 text-xs font-mono">{children}</code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-gray-900 dark:bg-black/40 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-xs">{children}</pre>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} className="text-brand-600 dark:text-brand-400 underline" target="_blank" rel="noopener noreferrer">{children}</a>
  ),
};

function TextContent({ text }: { text: string }) {
  return <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{text}</Markdown>;
}

/* ─── Message skeleton ───────────────────────────────────────────── */

function MessageSkeleton() {
  return (
    <div className="flex gap-3 animate-in fade-in duration-150">
      <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2.5 pt-1">
        <div className="h-3.5 bg-gray-100 dark:bg-white/[0.06] rounded-md w-3/4 animate-pulse" />
        <div className="h-3.5 bg-gray-100 dark:bg-white/[0.06] rounded-md w-1/2 animate-pulse" style={{ animationDelay: "75ms" }} />
        <div className="h-3.5 bg-gray-100 dark:bg-white/[0.06] rounded-md w-5/12 animate-pulse" style={{ animationDelay: "150ms" }} />
      </div>
    </div>
  );
}

/* ─── Message parts renderer ─────────────────────────────────────── */

function MessageParts({
  message,
  isLastMessage,
  chatStreaming,
}: {
  message: UIMessage;
  isLastMessage: boolean;
  chatStreaming: boolean;
}) {
  const { parts } = message;
  const isActivelyStreaming = isLastMessage && chatStreaming;

  if (parts.length === 0) return null;

  return (
    <div className="space-y-1">
      {parts.map((part, i) => {
        const isLastPart = i === parts.length - 1;
        const partStreaming = isActivelyStreaming && isLastPart;

        switch (part.type) {
          case "text":
            return <TextContent key={i} text={part.text} />;
          case "reasoning":
            return <ThinkingBlockUI key={i} text={part.text} isStreaming={partStreaming} />;
          default: {
            if (isToolUIPart(part)) {
              const tp = part as unknown as { type: string; toolCallId: string; toolName?: string; state: string; input?: unknown; output?: unknown };
              return <ToolInvocationUI key={tp.toolCallId} part={tp} />;
            }
            return null;
          }
        }
      })}
    </div>
  );
}

/* ─── Main chat component ────────────────────────────────────────── */

interface FeatureCreatorChatProps {
  chatId: string;
  featureContext: Record<string, unknown>;
  onFeatureUpdate?: (draft: Partial<FeatureDraft>) => void;
}

export function FeatureCreatorChat({
  chatId,
  featureContext,
  onFeatureUpdate,
}: FeatureCreatorChatProps) {
  const { showPaymentRequired } = useBillingGuard();
  const sessionIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userHasScrolledRef = useRef(false);
  const [showScrollPill, setShowScrollPill] = useState(false);
  const [input, setInput] = useState("");

  useEffect(() => {
    sessionIdRef.current = loadSessionId(chatId);
  }, [chatId]);

  const billingFetch = useCallback<typeof globalThis.fetch>(
    async (input, init) => {
      const response = await globalThis.fetch(input, init);
      if (response.status === 402) {
        const body = await response.json().catch(() => ({}));
        let billing = body;
        if (typeof body.error === "string" && body.balance_cents === undefined) {
          try { billing = JSON.parse(body.error); } catch { /* */ }
        }
        showPaymentRequired({
          balance_cents: billing.balance_cents,
          required_cents: billing.required_cents,
          error: typeof billing.error === "string" ? billing.error : "Insufficient credits",
        });
        throw new Error(billing.error || "Insufficient credits");
      }
      return response;
    },
    [showPaymentRequired],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/v1/chat",
        fetch: billingFetch,
        prepareSendMessagesRequest: ({ messages: msgs }) => ({
          body: {
            message:
              msgs
                .filter((m) => m.role === "user")
                .pop()
                ?.parts?.find((p): p is { type: "text"; text: string } => p.type === "text")?.text || "",
            sessionId: sessionIdRef.current,
            context: featureContext,
          },
        }),
      }),
    [featureContext, billingFetch],
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: `feature-creator-${chatId}`,
    transport,
    messages: loadMessages(chatId),
    onData: (data: { type: string; data?: unknown }) => {
      if (data.type === "data-session" && data.data) {
        const d = data.data as { sessionId: string };
        sessionIdRef.current = d.sessionId;
        saveSessionId(chatId, d.sessionId);
      }
    },
    onFinish: ({ messages: finalMessages }) => {
      saveMessages(chatId, finalMessages);
      // Try to extract feature definition from the last assistant message
      if (onFeatureUpdate) {
        const lastAssistant = [...finalMessages].reverse().find((m) => m.role === "assistant");
        if (lastAssistant) {
          const toolParts = lastAssistant.parts.filter((p) => {
            const tp = p as { type: string; toolName?: string; state?: string; output?: unknown };
            return tp.toolName === "update_feature" && tp.state === "output-available" && tp.output;
          });
          for (const tp of toolParts) {
            const part = tp as unknown as { output: unknown };
            try {
              const output = typeof part.output === "string" ? JSON.parse(part.output) : part.output;
              if (output && typeof output === "object") {
                onFeatureUpdate(output as Partial<FeatureDraft>);
              }
            } catch { /* */ }
          }
        }
      }
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Auto-scroll: use a ref so the scroll callback never has a stale closure
  useEffect(() => {
    if (scrollRef.current && !userHasScrolledRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function handleScroll() {
      if (!el) return;
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      userHasScrolledRef.current = !isAtBottom;
      setShowScrollPill(!isAtBottom);
    }
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 144) + "px";
  }, [input]);

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;
      setInput("");
      userHasScrolledRef.current = false;
      setShowScrollPill(false);
      sendMessage({ text });
    },
    [isStreaming, sendMessage],
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    handleSend(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  const resetChat = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = null;
    clearChat(chatId);
  }, [chatId, setMessages]);

  const hasMessages = messages.length > 0;
  const lastMsg = messages[messages.length - 1];
  const showSkeleton = isStreaming && lastMsg?.role === "assistant" && lastMsg.parts.length === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      {hasMessages && (
        <div className="flex items-center justify-end px-4 py-1.5 border-b border-gray-100 dark:border-white/[0.04] bg-white dark:bg-transparent">
          <button
            type="button"
            onClick={resetChat}
            disabled={isStreaming}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition disabled:opacity-50"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
            Reset chat
          </button>
        </div>
      )}

      {/* Messages */}
      {hasMessages ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
            {messages.map((msg, i) => {
              const userText = msg.parts
                .filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map((p) => p.text)
                .join("");

              return msg.role === "user" ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] bg-brand-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed">
                    <span className="whitespace-pre-wrap">{userText}</span>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i === messages.length - 1 && isStreaming ? (
                      <span className="flex gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    ) : (
                      <SparklesIcon className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                    {i === messages.length - 1 && showSkeleton ? (
                      <MessageSkeleton />
                    ) : (
                      <MessageParts
                        message={msg}
                        isLastMessage={i === messages.length - 1}
                        chatStreaming={isStreaming}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500/10 to-brand-600/10 flex items-center justify-center mb-4">
            <SparklesIcon className="w-6 h-6 text-brand-500" />
          </div>
          <h3 className="font-display font-bold text-gray-900 dark:text-gray-100 text-lg mb-1">
            Design your feature
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs leading-relaxed">
            Describe what your feature should do. I&apos;ll help you define the inputs and outputs.
          </p>
        </div>
      )}

      {/* Scroll-to-bottom pill */}
      {showScrollPill && hasMessages && (
        <div className="flex justify-center -mt-12 mb-2 relative z-10 pointer-events-none">
          <button
            type="button"
            onClick={() => {
              userHasScrolledRef.current = false;
              setShowScrollPill(false);
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
            }}
            className="pointer-events-auto px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/[0.1] rounded-full shadow-md hover:shadow-lg transition-all text-gray-600 dark:text-gray-300"
          >
            Scroll to bottom
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-100 dark:border-white/[0.06] bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-4 py-3">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 bg-gray-50 dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/[0.08] pl-4 pr-2 py-2 focus-within:border-brand-300 dark:focus-within:border-brand-500/40 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your feature..."
              disabled={isStreaming}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none disabled:opacity-50 py-1.5 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              style={{ maxHeight: 144 }}
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={() => stop()}
                className="w-8 h-8 rounded-xl bg-gray-200 dark:bg-white/[0.1] text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-gray-300 transition-colors flex-shrink-0"
                title="Stop generating"
              >
                <StopIcon className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              >
                <ArrowUpIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
