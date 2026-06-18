"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { useBillingGuard } from "@/lib/billing-guard";
import {
  SparklesIcon,
  XMarkIcon,
  WrenchScrewdriverIcon,
  ArrowUpIcon,
  StopIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/20/solid";

/**
 * Edit-with-AI — REAL LLM chat (replaces the client-side interpreter mock).
 *
 * POSTs to /api/v1/chat (api-service → chat-service) with a `configKey`
 * ("persona-editor" | "brand-profile-editor") and live request context.
 * chat-service resolves the config's system prompt + tools and streams tool
 * calls back; the tools read/edit the brand's personas / brand profile in
 * brand-service. We render streamed tool calls generically and, whenever a turn
 * finishes, invalidate the page's React Query keys so the cards reflect the
 * AI's changes. Mirrors the campaign-prefill chat wiring.
 */

const STORAGE_PREFIX = "edit-with-ai-chat";
type EditChatContext = Record<string, unknown>;

function loadSessionId(k: string): string | null {
  try { return localStorage.getItem(`${STORAGE_PREFIX}-session:${k}`); } catch { return null; }
}
function saveSessionId(k: string, id: string) {
  try { localStorage.setItem(`${STORAGE_PREFIX}-session:${k}`, id); } catch { /* */ }
}

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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  intro: string;
  suggestions: string[];
  configKey: "persona-editor" | "brand-profile-editor";
  brandId: string;
  context?: EditChatContext;
  /** Optional storage namespace bump to avoid replaying stale backend sessions after config/context changes. */
  sessionVersion?: string;
  /** React Query keys to invalidate after each turn (so the cards reflect AI edits). */
  invalidateKeys: unknown[][];
}) {
  const queryClient = useQueryClient();
  const { showPaymentRequired } = useBillingGuard();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const chatKey = sessionVersion ? `${configKey}:${sessionVersion}:${brandId}` : `${configKey}:${brandId}`;
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
  }, [chatKey]);

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

  const { messages, sendMessage, status, stop, error } = useChat({
    id: `edit-ai-${chatKey}`,
    transport,
    messages: [{ id: "intro", role: "assistant", parts: [{ type: "text", text: intro }] } as UIMessage],
    onData: (data: { type: string; data?: unknown }) => {
      if (data.type === "data-session" && data.data) {
        const d = data.data as { sessionId: string };
        sessionIdRef.current = d.sessionId;
        saveSessionId(chatKey, d.sessionId);
      }
    },
    onFinish: () => {
      // A turn finished — the AI may have created / edited a persona or saved a
      // brand-profile version. Refresh the page's queries so the cards update.
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || isStreaming) return;
    sendMessage({ text: value });
    setDraft("");
  };

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(draft);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col border-l border-gray-200 animate-slide-in-right">
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

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className="max-w-[85%] space-y-2">
                {m.parts?.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <div
                        key={i}
                        className={
                          m.role === "user"
                            ? "rounded-2xl rounded-br-sm bg-brand-600 text-white text-sm px-3.5 py-2 whitespace-pre-line"
                            : "rounded-2xl rounded-bl-sm bg-gray-100 text-gray-800 text-sm px-3.5 py-2 whitespace-pre-line"
                        }
                      >
                        {(part as { text: string }).text}
                      </div>
                    );
                  }
                  if (isToolUIPart(part)) {
                    const tp = part as unknown as { toolName?: string; type: string; state: string };
                    const name = tp.toolName ?? tp.type.replace(/^tool-/, "");
                    const done = tp.state === "output-available";
                    const errored = tp.state === "output-error";
                    return (
                      <div key={i} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        <WrenchScrewdriverIcon className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" />
                        <span className="min-w-0 flex-1 font-mono text-[11px] text-gray-500">{name}</span>
                        {errored ? (
                          <XCircleIcon className="w-3.5 h-3.5 text-red-500/70 shrink-0" />
                        ) : done ? (
                          <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500/70 shrink-0" />
                        ) : null}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error.message ?? "Something went wrong."}
            </div>
          )}

          {messages.length === 1 && suggestions.length > 0 && (
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

        {/* Input */}
        <form onSubmit={onFormSubmit} className="border-t border-gray-200 p-3">
          <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-500/10 transition">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
              rows={1}
              placeholder="Ask the AI to make a change…"
              className="flex-1 resize-none text-sm text-gray-800 bg-transparent focus:outline-none max-h-32"
            />
            {isStreaming ? (
              <button type="button" onClick={() => stop()} aria-label="Stop" className="shrink-0 rounded-lg bg-gray-200 p-1.5 text-gray-700 hover:bg-gray-300 transition">
                <StopIcon className="w-4 h-4" />
              </button>
            ) : (
              <button type="submit" disabled={!draft.trim()} aria-label="Send" className="shrink-0 rounded-lg bg-brand-600 p-1.5 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
                <ArrowUpIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
