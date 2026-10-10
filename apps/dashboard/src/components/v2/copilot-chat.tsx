"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ApiError,
  ChatChoicesRecordSchema,
  ChatOpenPageRecordSchema,
  getChatSessionHistory,
  getLatestChatSession,
  type ChatSessionHistory,
} from "@/lib/api";
import { historyToUIMessages } from "@/lib/chat-session-history";
import { isSessionNotFoundError } from "@/lib/chat-session";
import {
  COPILOT_CONFIG_KEY,
  COPILOT_OPENER,
  choicesByTurn,
  copilotPageHref,
  copilotSessionStorageKey,
  isOpener,
  isPanelLink,
  isThisBrandsSession,
  openPagesByTurn,
  creditsRequiredByTurn,
  addCreditsHref,
  readCreditsRequired,
  type CopilotChoices,
  type CopilotCreditsRequired,
  type CopilotOpenPage,
} from "@/lib/copilot";
import { v2Href } from "@/lib/v2/routes";
import { formatCount, formatCentsAsUsdAdaptive } from "@/lib/format-number";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { shownReturn } from "@/lib/maturity";
import { useStatBasis } from "@/lib/use-stat-basis";
import { SINCE_INCEPTION } from "@/lib/revenue-window";
import { useBrandInfo, useBrandRevenue, useBrandRevenueWindow, useNeedsYourCall } from "@/components/v2/data";
import { Figure, Shimmer } from "@/components/v2/ui";
import { AddCreditsButton, ChoiceCards, OpenedPage } from "@/components/v2/copilot-cards";
import { useSelectedOfferIfAny } from "@/components/v2/selected-offer";

/**
 * The Copilot (owner 2026-10-09, GA 2026-10-10), drawn inside the right panel. A reload shows the last
 * conversation; "New chat" starts over with the account's figures (Today's own reads, so
 * the numbers match the page) and the model's first choices. Every answer ends on large
 * choices to click, the box below stays for anything else. A dashboard link the model
 * writes opens beside the panel, the chat stays where it is.
 */

function loadSessionId(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function saveSessionId(key: string, id: string | null) {
  try {
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    // Private mode: the conversation still runs, it just will not come back after a reload.
  }
}

/** Today's headline figures, read through Today's own hooks (one cache, one number). */
function useAccountFigures(brandId: string) {
  const brandName = useBrandInfo(brandId).data?.brand?.name ?? null;
  const rev = useBrandRevenue(brandId);
  const win = useBrandRevenueWindow(brandId, SINCE_INCEPTION);
  const callQ = useNeedsYourCall(brandId, 5);
  const { basis } = useStatBasis();
  const roi = shownReturn(rev.data?.costEconomics.maturity, basis);
  const w = win.data ?? null;
  const figures = {
    brandName,
    returnMultiple: roi.learning ? null : roi.value,
    returnIsLearning: roi.learning,
    positiveReplies: w?.recipientsRepliesPositive.total ?? null,
    needYourCall: callQ.data?.total ?? null,
    emailsSent: w?.emails?.sent ?? null,
    emailsDelivered: w?.emails?.delivered ?? null,
    spentCents: w?.spend?.actualSpentCents ?? null,
  };
  // Settled = every read answered or failed (a brand with no offer answers "not enabled").
  const settled = !rev.pending && !win.pending && (callQ.isFetched || callQ.isError || !callQ.isEnabled);
  return { figures, settled, revPending: rev.pending, winPending: win.pending };
}

type AccountFigures = ReturnType<typeof useAccountFigures>["figures"];

function AccountCard({
  orgId,
  brandId,
  figures,
  revPending,
  winPending,
}: {
  orgId: string;
  brandId: string;
  figures: AccountFigures;
  revPending: boolean;
  winPending: boolean;
}) {
  const cells: { label: string; pending: boolean; value: string; sub?: string; good?: boolean }[] = [
    {
      label: "Return",
      pending: revPending,
      good: !figures.returnIsLearning && roiIsGood(figures.returnMultiple),
      value: figures.returnIsLearning ? "Learning" : figures.returnMultiple != null ? formatRoi(figures.returnMultiple) : "—",
    },
    {
      label: "Positive replies",
      pending: winPending,
      value: figures.positiveReplies != null ? formatCount(figures.positiveReplies) : "—",
      sub: figures.needYourCall ? `${formatCount(figures.needYourCall)} need your call` : undefined,
    },
    {
      label: "Delivered",
      pending: winPending,
      value: figures.emailsDelivered != null ? formatCount(figures.emailsDelivered) : "—",
      sub: figures.emailsSent != null ? `of ${formatCount(figures.emailsSent)} emails` : undefined,
    },
    {
      label: "Spent",
      pending: winPending,
      value: figures.spentCents != null ? formatCentsAsUsdAdaptive(figures.spentCents) : "—",
    },
  ];
  return (
    <div className="k-card overflow-hidden">
      <div className="flex items-baseline justify-between px-4 pt-3">
        <span className="k-label">{figures.brandName ?? "Your account"}</span>
        <Link href={v2Href(orgId, brandId, "today")} className="k-fg3 text-[12px] hover:text-[var(--fg-1)]">
          Since you started →
        </Link>
      </div>
      <div className="grid grid-cols-2 divide-[var(--line-subtle)] @2xl:grid-cols-4 @2xl:divide-x">
        {cells.map((c) => (
          <div key={c.label} className="min-w-0 px-4 pb-3.5 pt-2">
            <span className="k-fg3 text-[12px]">{c.label}</span>
            <div className="mt-1">{c.pending ? <Shimmer className="h-7 w-16" /> : <Figure value={c.good ? <span className="text-[var(--run)]">{c.value}</span> : c.value} />}</div>
            <p className="k-fg3 mt-0.5 truncate text-[12px] tabular-nums">{c.pending ? " " : c.sub ?? " "}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function textOf(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/** The cards of one live turn: rich `choices` (present_choices), else plain `buttons`. */
function liveChoices(m: UIMessage): CopilotChoices | null {
  for (const p of m.parts as Array<{ type: string; data?: unknown }>) {
    if (p.type === "data-choices") {
      const r = ChatChoicesRecordSchema.safeParse(p.data);
      if (r.success && r.data.choices.length > 0) return r.data;
      console.error("[copilot] a choices event the dashboard cannot read", p.data);
    }
  }
  for (const p of m.parts as Array<{ type: string; data?: { buttons?: { label: string; value: string }[] } }>) {
    if (p.type === "data-buttons" && p.data?.buttons?.length) return { choices: p.data.buttons };
  }
  return null;
}

/** The out-of-credits action of one live turn (chat-service `credits_required`), if any. */
function liveCreditsRequired(m: UIMessage): CopilotCreditsRequired | null {
  for (const p of m.parts as Array<{ type: string; data?: unknown }>) {
    if (p.type === "data-credits-required") return readCreditsRequired(p.data);
  }
  return null;
}

/** The pages one live turn opened. */
function livePages(m: UIMessage): CopilotOpenPage[] {
  const out: CopilotOpenPage[] = [];
  for (const p of m.parts as Array<{ type: string; data?: unknown }>) {
    if (p.type !== "data-open-page") continue;
    const r = ChatOpenPageRecordSchema.safeParse(p.data);
    if (r.success) out.push(r.data);
    else console.error("[copilot] an open_page event the dashboard cannot read", p.data);
  }
  return out;
}

const md = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-3 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-medium">{children}</strong>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
  code: ({ children }: { children?: React.ReactNode }) => <code className="k-inset k-mono rounded px-1 text-[12px]">{children}</code>,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) =>
    isPanelLink(href) ? (
      <Link href={href} className="text-[var(--accent)] underline decoration-[var(--line-strong)] underline-offset-4">
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline decoration-[var(--line-strong)] underline-offset-4">
        {children}
      </a>
    ),
};

export function CopilotChat({ orgId, brandId, headerAction }: { orgId: string; brandId: string; headerAction?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const storageKey = copilotSessionStorageKey(orgId, brandId);
  const sessionIdRef = useRef<string | null>(null);
  const [historyChoices, setHistoryChoices] = useState<Map<string, CopilotChoices>>(new Map());
  const [historyPages, setHistoryPages] = useState<Map<string, CopilotOpenPage[]>>(new Map());
  const [historyCredits, setHistoryCredits] = useState<Map<string, CopilotCreditsRequired>>(new Map());
  const offerId = useSelectedOfferIfAny()?.offerId ?? null;
  // Loading the stored conversation, then either showing it or opening a new one.
  const [phase, setPhase] = useState<"loading" | "ready">("loading");
  const [openerWanted, setOpenerWanted] = useState(false);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { figures, settled, revPending, winPending } = useAccountFigures(brandId);

  // What the model reads on every turn: where the user is, the pages it may open, and the
  // account's served figures (it cites them, it never computes one).
  const context = useMemo(
    () => ({
      surface: "copilot",
      orgId,
      brandId,
      offerId,
      currentPage: pathname,
      account: figures,
    }),
    [orgId, brandId, offerId, pathname, figures],
  );
  const contextRef = useRef(context);
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  // onData is bound once by useChat: it reads these through refs.
  const routerRef = useRef(router);
  const orgIdRef = useRef(orgId);
  const brandIdRef = useRef(brandId);
  useEffect(() => {
    routerRef.current = router;
    orgIdRef.current = orgId;
    brandIdRef.current = brandId;
  }, [router, orgId, brandId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/v1/chat",
        prepareSendMessagesRequest: ({ messages: msgs }) => {
          const last = msgs.filter((m) => m.role === "user").pop();
          return {
            body: {
              message: last ? textOf(last) : "",
              configKey: COPILOT_CONFIG_KEY,
              ...(sessionIdRef.current ? { sessionId: sessionIdRef.current } : {}),
              context: contextRef.current,
            },
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, setMessages, status, error, regenerate, stop } = useChat({
    id: `copilot-${orgId}-${brandId}`,
    transport,
    onData: (data: { type: string; data?: unknown }) => {
      if (data.type === "data-session" && data.data) {
        const id = (data.data as { sessionId: string }).sessionId;
        sessionIdRef.current = id;
        saveSessionId(storageKey, id);
      }
      if (data.type === "data-error-info" && data.data && isSessionNotFoundError(data.data as { code: string; message: string })) {
        sessionIdRef.current = null;
        saveSessionId(storageKey, null);
      }
      // The model asked to show a page: it opens under the widget, the chat stays.
      if (data.type === "data-open-page") {
        const r = ChatOpenPageRecordSchema.safeParse(data.data);
        if (!r.success) return;
        const href = copilotPageHref(orgIdRef.current, brandIdRef.current, r.data);
        if (href) routerRef.current.push(href);
      }
    },
  });
  const busy = status === "streaming" || status === "submitted";

  // A reload shows the last conversation: the user's latest one for this brand on any device,
  // else the one this browser kept (sessions from before chat-service recorded the brand);
  // none opens a new chat.
  useEffect(() => {
    let cancelled = false;
    const localSid = loadSessionId(storageKey);
    setPhase("loading");
    const load = async (): Promise<ChatSessionHistory | null> => {
      const latest = await getLatestChatSession(COPILOT_CONFIG_KEY);
      if (isThisBrandsSession(latest, brandId)) return latest;
      return localSid ? getChatSessionHistory(localSid) : null;
    };
    load()
      .then((h) => {
        if (cancelled) return;
        if (!h) {
          sessionIdRef.current = null;
          setMessages([]);
          setHistoryChoices(new Map());
          setHistoryPages(new Map());
          setHistoryCredits(new Map());
          setOpenerWanted(true);
          setPhase("ready");
          return;
        }
        sessionIdRef.current = h.sessionId;
        saveSessionId(storageKey, h.sessionId);
        setMessages(historyToUIMessages(h.messages));
        setHistoryChoices(choicesByTurn(h.messages));
        setHistoryPages(openPagesByTurn(h.messages));
        setHistoryCredits(creditsRequiredByTurn(h.messages));
        setPhase("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (!(err instanceof ApiError && (err.status === 404 || err.status === 403))) {
          console.error("[copilot] could not load the last conversation", { localSid, err });
        }
        sessionIdRef.current = null;
        saveSessionId(storageKey, null);
        setMessages([]);
        setHistoryChoices(new Map());
        setHistoryPages(new Map());
        setHistoryCredits(new Map());
        setOpenerWanted(true);
        setPhase("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey, brandId, setMessages]);

  // A new chat opens on the model's read of the account, once the figures are in.
  useEffect(() => {
    if (!openerWanted || phase !== "ready" || !settled || busy) return;
    setOpenerWanted(false);
    sendMessage({ text: COPILOT_OPENER });
  }, [openerWanted, phase, settled, busy, sendMessage]);

  const newChat = useCallback(() => {
    stop();
    sessionIdRef.current = null;
    saveSessionId(storageKey, null);
    setMessages([]);
    setHistoryChoices(new Map());
    setHistoryPages(new Map());
    setHistoryCredits(new Map());
    setOpenerWanted(true);
  }, [stop, storageKey, setMessages]);

  const submit = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value || busy) return;
      sendMessage({ text: value });
      setDraft("");
    },
    [busy, sendMessage],
  );
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(draft);
  };

  // Follow the conversation down as it streams.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages]);

  // The box grows with what is typed (capped, then it scrolls).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  const shown = messages.filter((m) => !(m.role === "user" && isOpener(textOf(m))));
  const lastAssistantId = [...shown].reverse().find((m) => m.role === "assistant")?.id ?? null;

  return (
    <section className="@container flex h-full min-w-0 flex-col" aria-label="Copilot">
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        <span className="k-fg2 text-[13px]">Copilot</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={newChat} className="k-btn-ghost gap-1.5" title="Start a new chat">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          New chat
          </button>
          {headerAction}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="k-scroll min-h-0 flex-1 overflow-y-auto"
        // A dashboard link the model wrote opens beside the panel; the chat keeps its place.
        onClickCapture={(e) => {
          const a = (e.target as HTMLElement).closest("a");
          const href = a?.getAttribute("href");
          if (isPanelLink(href) && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            router.push(href);
          }
        }}
      >
        <div className="mx-auto w-full max-w-[760px] px-4 pb-6 pt-2">
          <AccountCard orgId={orgId} brandId={brandId} figures={figures} revPending={revPending} winPending={winPending} />

          {phase === "loading" && (
            <div className="mt-6 space-y-2">
              <Shimmer className="h-4 w-3/4" />
              <Shimmer className="h-4 w-1/2" />
            </div>
          )}

          {shown.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="mt-6 flex justify-end">
                <div className="k-inset max-w-[85%] whitespace-pre-wrap rounded-[12px] px-3.5 py-2 text-[14px] leading-6">{textOf(m)}</div>
              </div>
            ) : (
              <div key={m.id} className="mt-6 text-[14px] leading-6">
                {m.parts.map((p, i) => {
                  if (p.type === "text") return <Markdown key={i} remarkPlugins={[remarkGfm]} components={md}>{p.text}</Markdown>;
                  if (isToolUIPart(p)) {
                    // The cards and the opened page draw themselves; no "read" line for them.
                    if (p.type === "tool-present_choices" || p.type === "tool-open_page") return null;
                    const name = p.type.replace(/^tool-/, "").replace(/_/g, " ");
                    const done = p.state === "output-available";
                    return (
                      <p key={i} className="k-fg3 my-1 text-[12px]">
                        {done ? "Read" : "Reading"} {name}
                        {done ? "" : "…"}
                      </p>
                    );
                  }
                  return null;
                })}
                {[...livePages(m), ...(historyPages.get(m.id) ?? [])].map((pg, i) => {
                  const href = copilotPageHref(orgId, brandId, pg);
                  return href ? <OpenedPage key={`p${i}`} href={href} label={pg.title ?? pg.page} /> : null;
                })}
                {(() => {
                  const credits = liveCreditsRequired(m) ?? historyCredits.get(m.id) ?? null;
                  const href = credits ? addCreditsHref(orgId, brandId) : null;
                  return credits && href ? <AddCreditsButton href={href} label={credits.label} /> : null;
                })()}
                {m.id === lastAssistantId && !busy && (() => {
                  const set = liveChoices(m) ?? historyChoices.get(m.id) ?? null;
                  return set ? <ChoiceCards set={set} disabled={busy} onPick={(c) => submit(c.value)} /> : null;
                })()}
              </div>
            ),
          )}

          {busy && shown[shown.length - 1]?.role !== "assistant" && (
            <div className="mt-6 space-y-2">
              <Shimmer className="h-4 w-2/3" />
              <Shimmer className="h-4 w-1/3" />
            </div>
          )}

          {error && !busy && (
            <div className="k-card mt-6 flex items-center justify-between gap-3 px-4 py-3">
              <p className="k-fg2 min-w-0 text-[13px]">The copilot could not answer: {error.message}</p>
              <button type="button" className="k-btn shrink-0" onClick={() => regenerate()}>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="mx-auto w-full max-w-[760px] shrink-0 px-4 pb-4">
        <div className="k-card flex items-end gap-2 px-3 py-2.5">
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(draft);
              }
            }}
            placeholder="Ask anything, or pick a choice above"
            className="k-scroll max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent text-[14px] leading-6 outline-none placeholder:text-[var(--fg-3)]"
          />
          {busy ? (
            <button type="button" onClick={() => stop()} className="k-btn shrink-0" aria-label="Stop">
              Stop
            </button>
          ) : (
            <button type="submit" disabled={!draft.trim()} className="k-btn-accent shrink-0" aria-label="Send">
              Send
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
