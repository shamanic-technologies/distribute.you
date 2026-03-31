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
import { useQueryClient } from "@tanstack/react-query";
import { useBillingGuard } from "@/lib/billing-guard";
import { listWorkflows } from "@/lib/api";
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
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/20/solid";
import { MermaidDiagram } from "./mermaid-diagram";

/* ─── Notification sound ─────────────────────────────────────────────── */

function playDing() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    // Audio not available
  }
}

/* ─── LocalStorage persistence ───────────────────────────────────────── */

function sessionKey(workflowId: string) {
  return `workflow-chat-session:${workflowId}`;
}
function messagesKey(workflowId: string) {
  return `workflow-chat-msgs:${workflowId}`;
}

function loadSessionId(workflowId: string): string | null {
  try {
    return localStorage.getItem(sessionKey(workflowId));
  } catch {
    return null;
  }
}

function saveSessionId(workflowId: string, sessionId: string) {
  try {
    localStorage.setItem(sessionKey(workflowId), sessionId);
  } catch {
    /* quota exceeded */
  }
}

function loadMessages(workflowId: string): UIMessage[] {
  try {
    const raw = localStorage.getItem(messagesKey(workflowId));
    if (!raw) return [];
    return JSON.parse(raw) as UIMessage[];
  } catch {
    return [];
  }
}

function saveMessages(workflowId: string, messages: UIMessage[]) {
  try {
    localStorage.setItem(messagesKey(workflowId), JSON.stringify(messages));
  } catch {
    /* quota exceeded */
  }
}

function clearChat(workflowId: string) {
  localStorage.removeItem(sessionKey(workflowId));
  localStorage.removeItem(messagesKey(workflowId));
  // Also remove legacy v1 storage
  localStorage.removeItem(`workflow-chat:${workflowId}`);
}

/* ─── Collapsible wrapper ────────────────────────────────────────────── */

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

  const variantStyles = {
    default:
      "bg-gray-50/80 dark:bg-white/[0.04] border-gray-200/60 dark:border-white/[0.08] text-gray-600 dark:text-gray-300",
    thinking:
      "bg-amber-50/50 dark:bg-amber-500/[0.06] border-amber-200/50 dark:border-amber-400/[0.12] text-amber-700 dark:text-amber-300",
    error:
      "bg-red-50/50 dark:bg-red-500/[0.06] border-red-200/50 dark:border-red-400/[0.12] text-red-700 dark:text-red-300",
  };

  return (
    <div
      className={`my-2 rounded-xl border ${variantStyles[variant]} overflow-hidden transition-colors`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium hover:opacity-80 transition-opacity"
      >
        <ChevronRightIcon
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
        {icon}
        <span className="truncate">{label}</span>
        <span className="ml-auto flex items-center gap-1">
          {isStreaming ? (
            <span className="flex gap-0.5">
              <span
                className="w-1 h-1 rounded-full bg-current animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1 h-1 rounded-full bg-current animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1 h-1 rounded-full bg-current animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </span>
          ) : statusIcon ? (
            statusIcon
          ) : null}
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

/* ─── Pretty JSON renderer ───────────────────────────────────────────── */

function PrettyJSON({ value }: { value: string }) {
  let formatted: string;
  try {
    formatted = JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    formatted = value;
  }
  return (
    <pre className="bg-gray-900/[0.04] dark:bg-white/[0.04] rounded-lg p-2.5 overflow-x-auto text-[11px] leading-relaxed font-mono text-gray-700 dark:text-gray-300 border border-gray-200/40 dark:border-white/[0.06]">
      {formatted}
    </pre>
  );
}

/* ─── Thinking block ─────────────────────────────────────────────────── */

function ThinkingBlockUI({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming?: boolean;
}) {
  return (
    <Collapsible
      label={isStreaming ? "Thinking..." : "Thought process"}
      icon={<SparklesIcon className="w-3.5 h-3.5 flex-shrink-0" />}
      statusIcon={
        !isStreaming ? (
          <CheckCircleIcon className="w-3.5 h-3.5 opacity-50" />
        ) : undefined
      }
      isStreaming={isStreaming}
      variant="thinking"
    >
      <div className="leading-relaxed opacity-70">
        {text ? <TextContent text={text} /> : <p>...</p>}
      </div>
    </Collapsible>
  );
}

/* ─── Tool invocation block ──────────────────────────────────────────── */

function getToolName(part: { type: string; toolName?: string }): string {
  // DynamicToolUIPart has toolName directly
  if (part.toolName) return part.toolName;
  // Static ToolUIPart has type "tool-{name}"
  if (part.type.startsWith("tool-")) return part.type.slice(5);
  return "unknown";
}

function ToolInvocationUI({ part }: { part: { type: string; toolCallId: string; toolName?: string; state: string; input?: unknown; output?: unknown } }) {
  const friendlyName = getToolName(part)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const isWaiting =
    part.state === "input-streaming" || part.state === "input-available";
  const hasResult = part.state === "output-available";

  let isError = false;
  if (hasResult && part.output) {
    try {
      const parsed =
        typeof part.output === "string"
          ? JSON.parse(part.output)
          : part.output;
      isError = parsed.success === false || !!parsed.error;
    } catch {
      // not JSON
    }
  }

  const argsStr =
    typeof part.input === "string"
      ? part.input
      : JSON.stringify(part.input ?? {});
  const resultStr =
    typeof part.output === "string"
      ? part.output
      : JSON.stringify(part.output ?? "");

  return (
    <Collapsible
      label={isWaiting ? `Calling ${friendlyName}...` : `Called ${friendlyName}`}
      icon={
        isWaiting ? (
          <ArrowPathIcon className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
        ) : (
          <WrenchScrewdriverIcon className="w-3.5 h-3.5 flex-shrink-0" />
        )
      }
      statusIcon={
        hasResult ? (
          isError ? (
            <XCircleIcon className="w-3.5 h-3.5 text-red-500/70 dark:text-red-400/70" />
          ) : (
            <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500/70 dark:text-emerald-400/70" />
          )
        ) : undefined
      }
      isStreaming={isWaiting}
      variant={isError ? "error" : "default"}
    >
      <div className="space-y-2.5">
        {argsStr && argsStr !== "{}" && (
          <div>
            <span className="font-semibold opacity-50 block mb-1 uppercase tracking-wider text-[10px]">
              Input
            </span>
            <PrettyJSON value={argsStr} />
          </div>
        )}
        {hasResult && (
          <div>
            <span className="font-semibold opacity-50 block mb-1 uppercase tracking-wider text-[10px]">
              Result
            </span>
            <div className="max-h-40 overflow-y-auto">
              <PrettyJSON value={resultStr} />
            </div>
          </div>
        )}
        {isWaiting && (
          <p className="opacity-40 italic text-[11px]">
            Waiting for result...
          </p>
        )}
      </div>
    </Collapsible>
  );
}

/* ─── Input request block ────────────────────────────────────────────── */

function InputRequestBlockUI({
  data,
  onSubmit,
  disabled,
}: {
  data: {
    inputType: string;
    label: string;
    placeholder?: string;
    field: string;
    value?: string;
  };
  onSubmit: (value: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(data.value ?? "");
  const inputType =
    data.inputType === "url"
      ? "url"
      : data.inputType === "email"
        ? "email"
        : "text";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="my-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {data.label}
      </label>
      <div className="flex gap-2">
        <input
          type={inputType}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={data.placeholder}
          disabled={disabled}
          className="flex-1 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 disabled:opacity-50 transition-shadow"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </form>
  );
}

/* ─── Buttons block ──────────────────────────────────────────────────── */

function ButtonsBlockUI({
  buttons,
  onSelect,
  disabled,
}: {
  buttons: Array<{ label: string; value: string }>;
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="my-3 flex flex-wrap gap-2">
      {buttons.map((btn, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(btn.value)}
          disabled={disabled}
          className="px-3.5 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-white/[0.1] text-gray-700 dark:text-gray-300 bg-white dark:bg-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.08] hover:border-brand-300 dark:hover:border-brand-400/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Mermaid + markdown parsing ─────────────────────────────────────── */

function parseMessageSegments(
  content: string,
): Array<{ type: "text" | "mermaid"; value: string }> {
  const segments: Array<{ type: "text" | "mermaid"; value: string }> = [];
  const regex = /```mermaid\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: content.slice(lastIndex, match.index),
      });
    }
    segments.push({ type: "mermaid", value: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return segments;
}

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="bg-gray-100 dark:bg-white/[0.08] text-gray-800 dark:text-gray-200 rounded px-1 py-0.5 text-xs font-mono">
      {children}
    </code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-gray-900 dark:bg-black/40 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-xs">
      {children}
    </pre>
  ),
  a: ({
    href,
    children,
  }: {
    href?: string;
    children?: React.ReactNode;
  }) => (
    <a
      href={href}
      className="text-brand-600 dark:text-brand-400 underline decoration-brand-300/40 hover:decoration-brand-400 transition-colors"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-gray-200 dark:border-white/[0.08]">
      <table className="min-w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-gray-50 dark:bg-white/[0.04] text-left text-xs font-medium text-gray-500 dark:text-gray-400">
      {children}
    </thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
      {children}
    </tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
      {children}
    </tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-2 font-medium">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{children}</td>
  ),
};

function TextContent({ text }: { text: string }) {
  const segments = parseMessageSegments(text);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "mermaid" ? (
          <MermaidDiagram
            key={i}
            chart={seg.value}
            className="my-3 bg-white dark:bg-white/[0.04] rounded-lg p-4 border border-gray-100 dark:border-white/[0.06]"
          />
        ) : (
          <Markdown key={i} remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {seg.value}
          </Markdown>
        ),
      )}
    </>
  );
}

/* ─── Skeleton shimmer ───────────────────────────────────────────────── */

function MessageSkeleton() {
  return (
    <div className="flex gap-3 animate-in fade-in duration-150">
      <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2.5 pt-1">
        <div className="h-3.5 bg-gray-100 dark:bg-white/[0.06] rounded-md w-3/4 animate-pulse" />
        <div
          className="h-3.5 bg-gray-100 dark:bg-white/[0.06] rounded-md w-1/2 animate-pulse"
          style={{ animationDelay: "75ms" }}
        />
        <div
          className="h-3.5 bg-gray-100 dark:bg-white/[0.06] rounded-md w-5/12 animate-pulse"
          style={{ animationDelay: "150ms" }}
        />
      </div>
    </div>
  );
}

/* ─── Message part renderer ──────────────────────────────────────────── */

function MessageParts({
  message,
  isLastMessage,
  chatStreaming,
  onSend,
}: {
  message: UIMessage;
  isLastMessage: boolean;
  chatStreaming: boolean;
  onSend: (text: string) => void;
}) {
  const { parts } = message;
  const isActivelyStreaming = isLastMessage && chatStreaming;

  if (parts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {parts.map((part, i) => {
        const isLastPart = i === parts.length - 1;
        const partStreaming = isActivelyStreaming && isLastPart;

        switch (part.type) {
          case "text":
            return <TextContent key={i} text={part.text} />;

          case "reasoning":
            return (
              <ThinkingBlockUI
                key={i}
                text={part.text}
                isStreaming={partStreaming}
              />
            );

          default: {
            // Tool parts (tool-* or dynamic-tool)
            if (isToolUIPart(part)) {
              const tp = part as unknown as { type: string; toolCallId: string; toolName?: string; state: string; input?: unknown; output?: unknown };
              return (
                <ToolInvocationUI
                  key={tp.toolCallId}
                  part={tp}
                />
              );
            }

            // Custom data parts (data-input-request, data-buttons, data-session)
            const p = part as { type: string; data?: unknown };
            if (p.type === "data-input-request" && p.data) {
              const d = p.data as {
                inputType: string;
                label: string;
                placeholder?: string;
                field: string;
                value?: string;
              };
              return (
                <InputRequestBlockUI
                  key={i}
                  data={d}
                  onSubmit={onSend}
                  disabled={chatStreaming}
                />
              );
            }
            if (p.type === "data-buttons" && p.data) {
              const d = p.data as {
                buttons: Array<{ label: string; value: string }>;
              };
              return (
                <ButtonsBlockUI
                  key={i}
                  buttons={d.buttons}
                  onSelect={onSend}
                  disabled={chatStreaming}
                />
              );
            }
            // data-session and unknown types: skip
            return null;
          }
        }
      })}
    </div>
  );
}

/* ─── Main chat component ────────────────────────────────────────────── */

interface WorkflowChatProps {
  workflowId: string;
  workflowContext: Record<string, unknown>;
  /** Called when the LLM forks the workflow (upgradedTo is set). Receives the new workflow ID. */
  onWorkflowUpgraded?: (newWorkflowId: string) => void;
  /** Set when polling detects the workflow was upgraded (forked). */
  upgradedTo?: string | null;
}

export function WorkflowChat({
  workflowId,
  workflowContext,
  onWorkflowUpgraded,
  upgradedTo,
}: WorkflowChatProps) {
  const queryClient = useQueryClient();
  const { showPaymentRequired } = useBillingGuard();
  const sessionIdRef = useRef<string | null>(null);
  const contextRef = useRef(workflowContext);
  contextRef.current = workflowContext;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userHasScrolledRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const [showScrollPill, setShowScrollPill] = useState(false);
  const [input, setInput] = useState("");

  // Load session ID from localStorage on mount / workflow change
  useEffect(() => {
    sessionIdRef.current = loadSessionId(workflowId);
  }, [workflowId]);

  // Custom fetch that intercepts 402 responses to show the credits modal
  const billingFetch = useCallback<typeof globalThis.fetch>(
    async (input, init) => {
      const response = await globalThis.fetch(input, init);
      if (response.status === 402) {
        const body = await response.json().catch(() => ({}));
        // Parse nested error body if api-service wrapped it as { error: "<json string>" }
        let billing = body;
        if (typeof body.error === "string" && body.balance_cents === undefined) {
          try { billing = JSON.parse(body.error); } catch { /* use body as-is */ }
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

  // Transport: transforms useChat request → our API format
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
                ?.parts?.find(
                  (p): p is { type: "text"; text: string } =>
                    p.type === "text",
                )?.text || "",
            configKey: "workflow",
            ...(sessionIdRef.current ? { sessionId: sessionIdRef.current } : {}),
            context: contextRef.current,
          },
        }),
      }),
    [billingFetch],
  );

  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
  } = useChat({
    id: `workflow-${workflowId}`,
    transport,
    messages: loadMessages(workflowId),
    onData: (data: { type: string; data?: unknown }) => {
      if (data.type === "data-session" && data.data) {
        const d = data.data as { sessionId: string };
        sessionIdRef.current = d.sessionId;
        saveSessionId(workflowId, d.sessionId);
      }
    },
    onFinish: ({ messages: finalMessages }) => {
      playDing();
      saveMessages(workflowId, finalMessages);
      void queryClient.invalidateQueries({
        queryKey: ["workflow", workflowId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["workflow-summary", workflowId],
      });
      // Refresh workflow list (new workflows may have been created/forked)
      void queryClient.invalidateQueries({ queryKey: ["workflows"] });
      // Check if the workflow was forked during this conversation
      if (onWorkflowUpgraded) {
        listWorkflows()
          .then(({ workflows }) => {
            const latestFork = workflows
              .filter((w) => w.forkedFrom === workflowId)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            if (latestFork) {
              // Copy chat history to the new workflow so conversation continues
              saveMessages(latestFork.id, finalMessages);
              if (sessionIdRef.current) {
                saveSessionId(latestFork.id, sessionIdRef.current);
              }
              onWorkflowUpgraded(latestFork.id);
            }
          })
          .catch(() => {});
      }
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Continuously persist messages to localStorage (debounced) so they survive
  // any re-render, Chat recreation, or workflowId change. Previously messages
  // were only saved in onFinish, which created a window where messages could
  // be lost if the Chat was recreated (e.g. during a fork/upgrade) before
  // onFinish fired.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveMessages(workflowId, messages);
    }, 300);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, workflowId]);

  // Flush pending save immediately on unmount so nothing is lost
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveMessages(workflowId, messages);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When workflowId changes (e.g. after a fork), hydrate chat from localStorage.
  // useChat's internal store is keyed by `id` — switching IDs starts empty,
  // so we must explicitly push the saved messages into the new store.
  const prevWorkflowIdRef = useRef(workflowId);
  useEffect(() => {
    if (prevWorkflowIdRef.current !== workflowId) {
      prevWorkflowIdRef.current = workflowId;
      setMessages(loadMessages(workflowId));
    }
  }, [workflowId, setMessages]);

  // Keep a ref to latest messages so the upgradedTo effect can access them without stale closures
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // When polling detects a fork (upgradedTo prop), copy chat history to the new workflow before navigating
  const hasMigratedRef = useRef(false);
  // Reset migration flag when workflowId changes (e.g. after a previous fork)
  useEffect(() => {
    hasMigratedRef.current = false;
  }, [workflowId]);
  useEffect(() => {
    if (!upgradedTo || hasMigratedRef.current) return;
    hasMigratedRef.current = true;
    // Cancel any pending debounced save — we'll save immediately below
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    // Save current in-flight messages to BOTH old and new workflow IDs.
    // Old ID: ensures localStorage is up-to-date in case the new Chat reads it.
    // New ID: so loadMessages(newId) finds the messages when useChat recreates.
    const currentMessages = messagesRef.current;
    saveMessages(workflowId, currentMessages);
    saveMessages(upgradedTo, currentMessages);
    if (sessionIdRef.current) {
      saveSessionId(upgradedTo, sessionIdRef.current);
    }
    onWorkflowUpgraded?.(upgradedTo);
  }, [upgradedTo, workflowId, onWorkflowUpgraded]);

  // Auto-scroll: defer to next frame so pending scroll events update the ref first
  useEffect(() => {
    if (userHasScrolledRef.current) return;
    const frame = requestAnimationFrame(() => {
      if (!userHasScrolledRef.current && scrollRef.current) {
        isProgrammaticScrollRef.current = true;
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [messages]);

  // Detect user scroll-up to pause auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function handleScroll() {
      if (!el) return;
      // Ignore scroll events triggered by programmatic auto-scroll
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false;
        return;
      }
      const isAtBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      const hasScrolled = !isAtBottom;
      userHasScrolledRef.current = hasScrolled;
      setShowScrollPill((prev) => (prev !== hasScrolled ? hasScrolled : prev));
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

  // Send handlers
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

  // Reset chat
  const resetChat = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = null;
    clearChat(workflowId);
  }, [workflowId, setMessages]);

  // Copy conversation as text
  const [copied, setCopied] = useState(false);
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
            const tp = part as unknown as { type: string; toolCallId: string; toolName?: string; state: string; input?: unknown; output?: unknown };
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

  const hasMessages = messages.length > 0;
  const lastMsg = messages[messages.length - 1];
  const showSkeleton =
    isStreaming &&
    lastMsg?.role === "assistant" &&
    lastMsg.parts.length === 0;
  // Show a pending indicator immediately after user sends, before assistant message appears
  const showPendingAssistant = isStreaming && lastMsg?.role === "user";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Chat toolbar */}
      {hasMessages && (
        <div className="flex items-center justify-end gap-3 px-4 py-1.5 border-b border-gray-100 dark:border-white/[0.04] bg-white dark:bg-transparent">
          <button
            type="button"
            onClick={copyConversation}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
          >
            {copied ? (
              <ClipboardDocumentCheckIcon className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <ClipboardDocumentIcon className="w-3.5 h-3.5" />
            )}
            {copied ? "Copied!" : "Copy conversation"}
          </button>
          <button
            type="button"
            onClick={resetChat}
            disabled={isStreaming}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                .filter(
                  (p): p is { type: "text"; text: string } =>
                    p.type === "text",
                )
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
                        <span
                          className="w-1 h-1 rounded-full bg-white animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <span
                          className="w-1 h-1 rounded-full bg-white animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="w-1 h-1 rounded-full bg-white animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
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
                        onSend={handleSend}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            {showPendingAssistant && (
              <div className="flex gap-3 animate-in fade-in duration-150">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
                <div className="flex-1 min-w-0 text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  <MessageSkeleton />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500/10 to-brand-600/10 dark:from-brand-400/10 dark:to-brand-500/10 flex items-center justify-center mb-4">
            <SparklesIcon className="w-6 h-6 text-brand-500 dark:text-brand-400" />
          </div>
          <h3 className="font-display font-bold text-gray-900 dark:text-gray-100 text-lg mb-1">
            Ask about this workflow
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs leading-relaxed">
            I can help you configure, run, or understand how this workflow works.
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
              scrollRef.current?.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: "smooth",
              });
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
              placeholder="Ask about this workflow..."
              disabled={isStreaming}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none disabled:opacity-50 py-1.5 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              style={{ maxHeight: 144 }}
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={() => stop()}
                className="w-8 h-8 rounded-xl bg-gray-200 dark:bg-white/[0.1] text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-white/[0.15] transition-colors flex-shrink-0"
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
