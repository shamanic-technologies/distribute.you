"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { useBillingGuard } from "@/lib/billing-guard";
import {
  SparklesIcon,
  XMarkIcon,
  ArrowUpIcon,
  StopIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/20/solid";
import {
  ThinkingBlockUI,
  ToolInvocationUI,
  TextContent,
  MessageSkeleton,
  BouncingDots,
} from "@/components/chat/chat-message-parts";
import {
  isSessionNotFoundError,
  clearStoredSession,
  SESSION_NOT_FOUND_NOTICE,
} from "@/lib/chat-session";

/**
 * Edit-with-AI — REAL LLM chat (replaces the client-side interpreter mock).
 *
 * POSTs to /api/v1/chat (api-service → chat-service) with a `configKey`
 * ("brand-profile-editor" | "audience-editor") and live request context.
 * chat-service resolves the config's system prompt + tools and streams tool calls
 * back; the tools read/edit the brand profile in brand-service ("brand-profile-editor")
 * or the brand's human-service audiences via the gateway ("audience-editor").
 *
 * The render layer mirrors the admin WorkflowChat's progress affordances:
 * a "Thinking..." reasoning block, expandable tool-call steps, a pending
 * placeholder shown the instant the user sends, markdown text, auto-scroll
 * with a scroll-to-bottom pill, an error banner with retry, and a reset /
 * copy toolbar. The token/context gauge is intentionally excluded from this
 * surface. Whenever a turn finishes we invalidate the page's React Query
 * keys so the cards reflect the AI's changes.
 */

const STORAGE_PREFIX = "edit-with-ai-chat";
type EditChatContext = Record<string, unknown>;

function loadSessionId(k: string): string | null {
  try { return localStorage.getItem(`${STORAGE_PREFIX}-session:${k}`); } catch { return null; }
}
function saveSessionId(k: string, id: string) {
  try { localStorage.setItem(`${STORAGE_PREFIX}-session:${k}`, id); } catch { /* */ }
}
function sessionStorageKey(k: string): string {
  return `${STORAGE_PREFIX}-session:${k}`;
}

const RETRYABLE_CODES = new Set(["model_overloaded", "rate_limited", "model_error"]);

export function EditWithAIChat({
  open,
  onClose,
  title,
  intro,
  suggestions,
  configKey,
  brandId,
  context,
  sessionVersion,
  invalidateKeys,
  showBackdrop = true,
  panelClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  intro: string;
  suggestions: string[];
  configKey: "brand-profile-editor" | "audience-editor";
  brandId: string;
  context?: EditChatContext;
  /** Optional storage namespace bump to avoid replaying stale backend sessions after config/context changes. */
  sessionVersion?: string;
  /** React Query keys to invalidate after each turn (so the cards reflect AI edits). */
  invalidateKeys: unknown[][];
  /** Dim the rest of the page behind the chat. Default true. Pass false when docked
   *  beside another panel so that panel stays visible/interactive (live-edit view). */
  showBackdrop?: boolean;
  /** Override the chat panel position/size (e.g. to dock left of a detail panel). */
  panelClassName?: string;
}) {
  const queryClient = useQueryClient();
  const { showPaymentRequired } = useBillingGuard();
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const userHasScrolledRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const [showScrollPill, setShowScrollPill] = useState(false);
  const [lastErrorInfo, setLastErrorInfo] = useState<{ code: string; message: string } | null>(null);
  const [sessionResetNotice, setSessionResetNotice] = useState(false);
  const [copied, setCopied] = useState(false);
  const chatKey = sessionVersion ? `${configKey}:${sessionVersion}:${brandId}` : `${configKey}:${brandId}`;
  const introMessage = useMemo<UIMessage>(
    () => ({ id: "intro", role: "assistant", parts: [{ type: "text", text: intro }] }) as UIMessage,
    [intro],
  );
  const requestContext = useMemo<EditChatContext>(
    () => ({ brandId, ...(context ?? {}) }),
    [brandId, context],
  );
  const contextRef = useRef(requestContext);

  useEffect(() => {
    contextRef.current = requestContext;
  }, [requestContext]);

  useEffect(() => {
    sessionIdRef.current = loadSessionId(chatKey);
    setSessionResetNotice(false);
  }, [chatKey]);

  // Auto-hide the session-reset notice after a few seconds
  useEffect(() => {
    if (!sessionResetNotice) return;
    const t = setTimeout(() => setSessionResetNotice(false), 4000);
    return () => clearTimeout(t);
  }, [sessionResetNotice]);

  // Surface a 402 (insufficient credits) via the billing guard, same as the
  // campaign-prefill chat.
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
            configKey,
            ...(sessionIdRef.current ? { sessionId: sessionIdRef.current } : {}),
            context: contextRef.current,
          },
        }),
      }),
    [billingFetch, configKey],
  );

  const { messages, sendMessage, regenerate, status, stop, setMessages, error } = useChat({
    id: `edit-ai-${chatKey}`,
    transport,
    messages: [introMessage],
    onData: (data: { type: string; data?: unknown }) => {
      if (data.type === "data-session" && data.data) {
        const d = data.data as { sessionId: string };
        sessionIdRef.current = d.sessionId;
        saveSessionId(chatKey, d.sessionId);
      }
      if (data.type === "data-error-info" && data.data) {
        const errInfo = data.data as { code: string; message: string };
        if (isSessionNotFoundError(errInfo)) {
          // Cached sessionId no longer matches a backend session — wipe it so
          // the next message starts fresh and surface a non-blocking notice.
          sessionIdRef.current = null;
          clearStoredSession(sessionStorageKey(chatKey));
          setSessionResetNotice(true);
          setLastErrorInfo(null);
          return;
        }
        setLastErrorInfo(errInfo);
      }
    },
    onFinish: () => {
      // A turn finished — the AI may have created / edited an audience or saved a
      // brand-profile version. Refresh the page's queries so the cards update.
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Auto-grow the input as the user types (the `max-h-32` cap then scrolls).
  // Without this the `rows={1}` textarea stays one line tall and multi-line
  // drafts scroll hidden inside it.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, open]);

  // Auto-scroll: defer to next frame so pending scroll events update the ref first.
  useEffect(() => {
    if (userHasScrolledRef.current) return;
    const frame = requestAnimationFrame(() => {
      if (!userHasScrolledRef.current && scrollRef.current) {
        isProgrammaticScrollRef.current = true;
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, open]);

  // Detect user scroll-up to pause auto-scroll + show the pill.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function handleScroll() {
      if (!el) return;
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false;
        return;
      }
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      const hasScrolled = !isAtBottom;
      userHasScrolledRef.current = hasScrolled;
      setShowScrollPill((prev) => (prev !== hasScrolled ? hasScrolled : prev));
    }
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [open]);

  // Auto-retry for rate_limited after 5 seconds.
  useEffect(() => {
    if (lastErrorInfo?.code !== "rate_limited" || isStreaming) return;
    const timer = setTimeout(() => {
      setLastErrorInfo(null);
      regenerate();
    }, 5000);
    return () => clearTimeout(timer);
  }, [lastErrorInfo, isStreaming, regenerate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value || isStreaming) return;
      setLastErrorInfo(null);
      userHasScrolledRef.current = false;
      setShowScrollPill(false);
      sendMessage({ text: value });
      setDraft("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    },
    [isStreaming, sendMessage],
  );

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(draft);
  };

  const retryLastMessage = useCallback(() => {
    setLastErrorInfo(null);
    regenerate();
  }, [regenerate]);

  const resetChat = useCallback(() => {
    setMessages([introMessage]);
    sessionIdRef.current = null;
    setLastErrorInfo(null);
    setSessionResetNotice(false);
    clearStoredSession(sessionStorageKey(chatKey));
  }, [chatKey, introMessage, setMessages]);

  const copyConversation = useCallback(() => {
    const text = messages
      .map((msg) => {
        const role = msg.role === "user" ? "User" : "Assistant";
        const sections: string[] = [];
        for (const part of msg.parts) {
          if (part.type === "reasoning") {
            const p = part as { type: "reasoning"; text: string };
            if (p.text) sections.push(`<thinking>\n${p.text}\n</thinking>`);
          } else if (part.type === "text") {
            const p = part as { type: "text"; text: string };
            if (p.text) sections.push(p.text);
          } else if (isToolUIPart(part)) {
            const tp = part as unknown as { type: string; toolName?: string; state: string; input?: unknown; output?: unknown };
            const toolName = tp.toolName ?? (tp.type.startsWith("tool-") ? tp.type.slice(5) : "unknown");
            const input = typeof tp.input === "string" ? tp.input : JSON.stringify(tp.input ?? {}, null, 2);
            const output = typeof tp.output === "string" ? tp.output : JSON.stringify(tp.output ?? "", null, 2);
            let block = `[Tool: ${toolName}]`;
            if (input && input !== "{}") block += `\nInput:\n${input}`;
            if (tp.state === "output-available" && output) block += `\nOutput:\n${output}`;
            sections.push(block);
          }
        }
        return `${role}:\n${sections.join("\n\n")}`;
      })
      .join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [messages]);

  if (!open) return null;

  const lastMsg = messages[messages.length - 1];
  // The assistant message exists but has no parts yet (first token pending).
  const showSkeleton = isStreaming && lastMsg?.role === "assistant" && lastMsg.parts.length === 0;
  // The user just sent — assistant message hasn't streamed in yet.
  const showPendingAssistant = isStreaming && lastMsg?.role === "user";
  // Suggestions only on a pristine conversation (intro only).
  const isPristine = messages.length === 1 && messages[0]?.id === "intro";

  return (
    <>
      {showBackdrop && <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />}
      <div className={panelClassName ?? "fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col border-l border-gray-200 animate-slide-in-right"}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 min-w-0">
            <SparklesIcon className="w-5 h-5 text-brand-500 shrink-0" />
            <h2 className="font-display font-semibold text-gray-800 truncate">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-100 text-gray-500 transition">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar — copy / reset (only once there's a real conversation) */}
        {!isPristine && (
          <div className="flex items-center justify-end gap-3 px-5 py-1.5 border-b border-gray-100">
            <button
              type="button"
              onClick={copyConversation}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition"
            >
              {copied ? (
                <ClipboardDocumentCheckIcon className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <ClipboardDocumentIcon className="w-3.5 h-3.5" />
              )}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              type="button"
              onClick={resetChat}
              disabled={isStreaming}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((m, mi) => {
            const isLastMessage = mi === messages.length - 1;
            if (m.role === "user") {
              const userText = m.parts
                .filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map((p) => p.text)
                .join("");
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 text-white text-sm px-3.5 py-2 whitespace-pre-line">
                    {userText}
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} className="flex justify-start">
                <div className="flex gap-2.5 max-w-[92%]">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shrink-0 mt-0.5">
                    {isLastMessage && isStreaming ? (
                      <BouncingDots />
                    ) : (
                      <SparklesIcon className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1 text-sm text-gray-800 leading-relaxed">
                    {isLastMessage && showSkeleton ? (
                      <MessageSkeleton />
                    ) : (
                      m.parts?.map((part, i) => {
                        const isLastPart = i === m.parts.length - 1;
                        const partStreaming = isLastMessage && isStreaming && isLastPart;
                        if (part.type === "text") {
                          return <TextContent key={i} text={(part as { text: string }).text} />;
                        }
                        if (part.type === "reasoning") {
                          return (
                            <ThinkingBlockUI
                              key={i}
                              text={(part as { text: string }).text}
                              isStreaming={partStreaming}
                            />
                          );
                        }
                        if (isToolUIPart(part)) {
                          const tp = part as unknown as { type: string; toolCallId: string; toolName?: string; state: string; input?: unknown; output?: unknown };
                          return <ToolInvocationUI key={tp.toolCallId} part={tp} />;
                        }
                        return null;
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pending placeholder — shows the instant the user sends. */}
          {showPendingAssistant && (
            <div className="flex justify-start animate-in fade-in duration-150">
              <div className="flex gap-2.5 max-w-[92%]">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shrink-0 mt-0.5">
                  <BouncingDots />
                </div>
                <div className="min-w-0 flex-1">
                  <MessageSkeleton />
                </div>
              </div>
            </div>
          )}

          {/* Error banner with optional retry. */}
          {(lastErrorInfo || error) && !isStreaming && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 animate-in fade-in duration-150">
              <p>{lastErrorInfo?.message ?? error?.message ?? "Something went wrong."}</p>
              {lastErrorInfo && RETRYABLE_CODES.has(lastErrorInfo.code) && (
                <button
                  type="button"
                  onClick={retryLastMessage}
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                  {lastErrorInfo.code === "rate_limited" ? "Retrying automatically..." : "Retry"}
                </button>
              )}
            </div>
          )}

          {isPristine && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="text-xs text-gray-500 hover:text-brand-600 border border-gray-200 hover:border-brand-300 rounded-full px-2.5 py-1 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scroll-to-bottom pill */}
        {showScrollPill && (
          <div className="flex justify-center -mt-10 mb-1 relative z-10 pointer-events-none">
            <button
              type="button"
              onClick={() => {
                userHasScrolledRef.current = false;
                setShowScrollPill(false);
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
              }}
              className="pointer-events-auto px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-full shadow-md hover:shadow-lg transition-all text-gray-600"
            >
              Scroll to bottom
            </button>
          </div>
        )}

        {/* Session-reset notice */}
        {sessionResetNotice && (
          <div className="shrink-0 px-5 py-2 bg-blue-50 border-t border-blue-200 text-xs text-blue-700 flex items-center gap-2">
            <ArrowPathIcon className="w-4 h-4 shrink-0" />
            <span>{SESSION_NOT_FOUND_NOTICE}</span>
          </div>
        )}

        {/* Input */}
        <form onSubmit={onFormSubmit} className="border-t border-gray-200 p-3">
          <div className="relative rounded-2xl border border-gray-200 bg-white px-4 py-3 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-500/10 transition">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
              rows={2}
              placeholder="Ask the AI to make a change…"
              className="block w-full resize-none bg-transparent pr-10 text-sm leading-relaxed text-gray-800 placeholder:text-gray-400 focus:outline-none min-h-[3rem] max-h-40 overflow-y-auto"
            />
            {isStreaming ? (
              <button type="button" onClick={() => stop()} aria-label="Stop" className="absolute bottom-2.5 right-2.5 shrink-0 rounded-lg bg-gray-200 p-1.5 text-gray-700 hover:bg-gray-300 transition">
                <StopIcon className="w-4 h-4" />
              </button>
            ) : (
              <button type="submit" disabled={!draft.trim()} aria-label="Send" className="absolute bottom-2.5 right-2.5 shrink-0 rounded-lg bg-brand-600 p-1.5 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
                <ArrowUpIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
