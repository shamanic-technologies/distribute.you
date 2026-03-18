"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Markdown from "react-markdown";
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
    // Audio not available (e.g. SSR or browser policy)
  }
}

/* ─── Content block types ────────────────────────────────────────────── */

interface TextBlock {
  type: "text";
  text: string;
}

interface ThinkingBlock {
  type: "thinking";
  thinking: string;
  isStreaming?: boolean;
}

interface ToolCallBlock {
  type: "tool_call";
  id: string;
  name: string;
  args: string;
  /** true while waiting for tool_result */
  isStreaming?: boolean;
}

interface ToolResultBlock {
  type: "tool_result";
  toolCallId: string;
  name: string;
  result: string;
}

interface InputRequestBlock {
  type: "input_request";
  inputType: "url" | "text" | "email";
  label: string;
  placeholder?: string;
  field: string;
  value?: string;
}

interface ButtonsBlock {
  type: "buttons";
  buttons: { label: string; value: string }[];
}

type ContentBlock = TextBlock | ThinkingBlock | ToolCallBlock | ToolResultBlock | InputRequestBlock | ButtonsBlock;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  blocks: ContentBlock[];
}

interface WorkflowChatProps {
  workflowId: string;
  workflowContext: Record<string, unknown>;
}

/* ─── Skeleton shimmer for loading state ─────────────────────────────── */

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

/* ─── LocalStorage persistence helpers ───────────────────────────────── */

interface PersistedChat {
  sessionId: string | null;
  messages: ChatMessage[];
}

function storageKey(workflowId: string) {
  return `workflow-chat:${workflowId}`;
}

function loadChat(workflowId: string): PersistedChat | null {
  try {
    const raw = localStorage.getItem(storageKey(workflowId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedChat;
    // Clean up streaming flags from a previous session
    for (const msg of parsed.messages) {
      for (const block of msg.blocks) {
        if ("isStreaming" in block) {
          (block as { isStreaming?: boolean }).isStreaming = false;
        }
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveChat(workflowId: string, sessionId: string | null, messages: ChatMessage[]) {
  try {
    localStorage.setItem(
      storageKey(workflowId),
      JSON.stringify({ sessionId, messages } satisfies PersistedChat),
    );
  } catch {
    // quota exceeded — silently ignore
  }
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
    default: "bg-gray-50/80 dark:bg-white/[0.04] border-gray-200/60 dark:border-white/[0.08] text-gray-600 dark:text-gray-300",
    thinking: "bg-amber-50/50 dark:bg-amber-500/[0.06] border-amber-200/50 dark:border-amber-400/[0.12] text-amber-700 dark:text-amber-300",
    error: "bg-red-50/50 dark:bg-red-500/[0.06] border-red-200/50 dark:border-red-400/[0.12] text-red-700 dark:text-red-300",
  };

  return (
    <div className={`my-2 rounded-xl border ${variantStyles[variant]} overflow-hidden transition-colors`}>
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
              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
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

/* ─── Thinking block ─────────────────────────────────────────────────── */

function ThinkingBlockUI({ block }: { block: ThinkingBlock }) {
  return (
    <Collapsible
      label={block.isStreaming ? "Thinking..." : "Thought process"}
      icon={<SparklesIcon className="w-3.5 h-3.5 flex-shrink-0" />}
      statusIcon={!block.isStreaming ? <CheckCircleIcon className="w-3.5 h-3.5 opacity-50" /> : undefined}
      isStreaming={block.isStreaming}
      variant="thinking"
      defaultOpen
    >
      <p className="leading-relaxed opacity-70">{block.thinking || "..."}</p>
    </Collapsible>
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

/* ─── Tool call block ────────────────────────────────────────────────── */

function ToolCallBlockUI({ block, result }: { block: ToolCallBlock; result?: ToolResultBlock }) {
  const friendlyName = block.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const isWaiting = block.isStreaming && !result;

  // Detect error in result
  let isError = false;
  if (result) {
    try {
      const parsed = JSON.parse(result.result);
      isError = parsed.success === false || !!parsed.error;
    } catch {
      // not JSON, not an error structure
    }
  }

  const statusLabel = isWaiting
    ? `Calling ${friendlyName}...`
    : `Called ${friendlyName}`;

  return (
    <Collapsible
      label={statusLabel}
      icon={
        isWaiting ? (
          <ArrowPathIcon className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
        ) : (
          <WrenchScrewdriverIcon className="w-3.5 h-3.5 flex-shrink-0" />
        )
      }
      statusIcon={
        result ? (
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
        {block.args && block.args !== "{}" && (
          <div>
            <span className="font-semibold opacity-50 block mb-1 uppercase tracking-wider text-[10px]">
              Input
            </span>
            <PrettyJSON value={block.args} />
          </div>
        )}
        {result && (
          <div>
            <span className="font-semibold opacity-50 block mb-1 uppercase tracking-wider text-[10px]">
              Result
            </span>
            <div className="max-h-40 overflow-y-auto">
              <PrettyJSON value={result.result} />
            </div>
          </div>
        )}
        {isWaiting && !result && (
          <p className="opacity-40 italic text-[11px]">Waiting for result...</p>
        )}
      </div>
    </Collapsible>
  );
}

/* ─── Input request block ────────────────────────────────────────────── */

function InputRequestBlockUI({
  block,
  onSubmit,
  disabled,
}: {
  block: InputRequestBlock;
  onSubmit: (value: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(block.value ?? "");
  const inputType = block.inputType === "url" ? "url" : block.inputType === "email" ? "email" : "text";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="my-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{block.label}</label>
      <div className="flex gap-2">
        <input
          type={inputType}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={block.placeholder}
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
  block,
  onSelect,
  disabled,
}: {
  block: ButtonsBlock;
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="my-3 flex flex-wrap gap-2">
      {block.buttons.map((btn, i) => (
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

function parseMessageSegments(content: string): Array<{ type: "text" | "mermaid"; value: string }> {
  const segments: Array<{ type: "text" | "mermaid"; value: string }> = [];
  const regex = /```mermaid\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
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
    <a href={href} className="text-brand-600 dark:text-brand-400 underline decoration-brand-300/40 hover:decoration-brand-400 transition-colors" target="_blank" rel="noopener noreferrer">{children}</a>
  ),
};

function TextContent({ text }: { text: string }) {
  const segments = parseMessageSegments(text);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "mermaid" ? (
          <MermaidDiagram key={i} chart={seg.value} className="my-3 bg-white dark:bg-white/[0.04] rounded-lg p-4 border border-gray-100 dark:border-white/[0.06]" />
        ) : (
          <Markdown key={i} components={markdownComponents}>
            {seg.value}
          </Markdown>
        )
      )}
    </>
  );
}

/* ─── Message content renderer (blocks-aware) ────────────────────────── */

function MessageContent({
  message,
  onSendMessage,
  isStreaming,
}: {
  message: ChatMessage;
  onSendMessage?: (text: string) => void;
  isStreaming?: boolean;
}) {
  const { blocks, content } = message;

  // Build a map of tool results keyed by tool call id
  const toolResults = new Map<string, ToolResultBlock>();
  for (const b of blocks) {
    if (b.type === "tool_result") {
      toolResults.set(b.toolCallId, b);
    }
  }

  const hasBlocks = blocks.some((b) => b.type !== "tool_result");

  if (!hasBlocks) {
    return <TextContent text={content} />;
  }

  return (
    <div className="space-y-1">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "thinking":
            return <ThinkingBlockUI key={i} block={block} />;
          case "tool_call":
            return <ToolCallBlockUI key={i} block={block} result={toolResults.get(block.id)} />;
          case "tool_result":
            return null;
          case "text":
            return <TextContent key={i} text={block.text} />;
          case "input_request":
            return (
              <InputRequestBlockUI
                key={i}
                block={block}
                onSubmit={(v) => onSendMessage?.(v)}
                disabled={isStreaming}
              />
            );
          case "buttons":
            return (
              <ButtonsBlockUI
                key={i}
                block={block}
                onSelect={(v) => onSendMessage?.(v)}
                disabled={isStreaming}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

/* ─── Helpers for updating blocks in state ────────────────────────────── */

function updateLastMessage(
  prev: ChatMessage[],
  updater: (msg: ChatMessage) => ChatMessage,
): ChatMessage[] {
  const updated = [...prev];
  updated[updated.length - 1] = updater(updated[updated.length - 1]);
  return updated;
}

function appendBlock(msg: ChatMessage, block: ContentBlock): ChatMessage {
  return { ...msg, blocks: [...msg.blocks, block] };
}

function updateLastBlock(msg: ChatMessage, updater: (block: ContentBlock) => ContentBlock): ChatMessage {
  const blocks = [...msg.blocks];
  blocks[blocks.length - 1] = updater(blocks[blocks.length - 1]);
  return { ...msg, blocks };
}

/* ─── Main chat component ────────────────────────────────────────────── */

export function WorkflowChat({ workflowId, workflowContext }: WorkflowChatProps) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const persisted = loadChat(workflowId);
    return persisted?.messages ?? [];
  });
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const sessionIdRef = useRef<string | null>(loadChat(workflowId)?.sessionId ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persist messages + sessionId on every change
  useEffect(() => {
    if (!isStreaming) {
      saveChat(workflowId, sessionIdRef.current, messages);
    }
  }, [messages, isStreaming, workflowId]);

  const resetChat = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = null;
    localStorage.removeItem(storageKey(workflowId));
  }, [workflowId]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current && !userHasScrolled) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [userHasScrolled]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Detect user scroll-up to pause auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function handleScroll() {
      if (!el) return;
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setUserHasScrolled(!isAtBottom);
    }
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-resize textarea up to 6 lines
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 144) + "px";
  }, [input]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text || isStreaming) return;
    setInput("");
    await handleSend(text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    await handleSend(trimmed);
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  async function handleSend(trimmed: string) {

    const userMessage: ChatMessage = { role: "user", content: trimmed, blocks: [] };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);
    setUserHasScrolled(false);

    // Add empty assistant message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "", blocks: [] }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const payload: Record<string, unknown> = {
        message: trimmed,
        context: workflowContext,
      };
      // Only include sessionId if we have one from a previous response
      if (sessionIdRef.current) {
        payload.sessionId = sessionIdRef.current;
      }

      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        setMessages((prev) =>
          updateLastMessage(prev, (msg) => ({
            ...msg,
            content: `Sorry, I encountered an error: ${errText}`,
            blocks: [{ type: "text", text: `Sorry, I encountered an error: ${errText}` }],
          })),
        );
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let receivedContent = false;
      const rawChunks: string[] = []; // keep raw data for error diagnostics

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        rawChunks.push(chunk);
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]" || payload === '"[DONE]"') continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(payload);
          } catch {
            // Not JSON -- could be a plain-text error from the server
            const errorText = payload.trim();
            if (errorText) {
              receivedContent = true;
              setMessages((prev) =>
                updateLastMessage(prev, (msg) => ({
                  ...msg,
                  content: errorText,
                  blocks: [{ type: "text" as const, text: errorText }],
                })),
              );
            }
            continue;
          }

          // First event: chat-service returns the session ID
          if (event.sessionId && !event.type) {
            sessionIdRef.current = event.sessionId as string;
            continue;
          }

          // Legacy: untyped error event (e.g. {"error": "Session not found."})
          if (event.error && !event.type) {
            receivedContent = true;
            const errorMsg = String(event.error);
            console.error("[chat] Server error (untyped):", errorMsg);
            setMessages((prev) =>
              updateLastMessage(prev, (msg) => ({
                ...msg,
                content: errorMsg,
                blocks: [
                  ...msg.blocks,
                  { type: "text" as const, text: errorMsg },
                ],
              })),
            );
            continue;
          }

          switch (event.type) {
            /* -- Text tokens -- */
            case "token": {
              const tokenText = (event.content || event.token || "") as string;
              if (!tokenText) break;
              receivedContent = true;
              setMessages((prev) =>
                updateLastMessage(prev, (msg) => {
                  const newContent = msg.content + tokenText;
                  const lastBlock = msg.blocks[msg.blocks.length - 1];
                  if (lastBlock?.type === "text") {
                    return {
                      ...msg,
                      content: newContent,
                      blocks: [
                        ...msg.blocks.slice(0, -1),
                        { type: "text", text: lastBlock.text + tokenText },
                      ],
                    };
                  }
                  return {
                    ...msg,
                    content: newContent,
                    blocks: [...msg.blocks, { type: "text", text: tokenText }],
                  };
                }),
              );
              break;
            }

            /* -- Thinking -- */
            case "thinking_start": {
              receivedContent = true;
              setMessages((prev) =>
                updateLastMessage(prev, (msg) =>
                  appendBlock(msg, { type: "thinking", thinking: "", isStreaming: true }),
                ),
              );
              break;
            }
            case "thinking_delta": {
              const delta = (event.thinking || "") as string;
              setMessages((prev) =>
                updateLastMessage(prev, (msg) => {
                  const lastBlock = msg.blocks[msg.blocks.length - 1];
                  if (lastBlock?.type === "thinking") {
                    return updateLastBlock(msg, (b) =>
                      b.type === "thinking" ? { ...b, thinking: b.thinking + delta } : b,
                    );
                  }
                  return appendBlock(msg, { type: "thinking", thinking: delta, isStreaming: true });
                }),
              );
              break;
            }
            case "thinking_stop": {
              setMessages((prev) =>
                updateLastMessage(prev, (msg) =>
                  updateLastBlock(msg, (b) =>
                    b.type === "thinking" ? { ...b, isStreaming: false } : b,
                  ),
                ),
              );
              break;
            }

            /* -- Tool calls (args arrive complete, no delta/stop) */
            case "tool_call": {
              receivedContent = true;
              setMessages((prev) =>
                updateLastMessage(prev, (msg) =>
                  appendBlock(msg, {
                    type: "tool_call",
                    id: (event.id || `tc_${Date.now()}`) as string,
                    name: (event.name || "unknown") as string,
                    args: typeof event.args === "string"
                      ? event.args
                      : JSON.stringify(event.args ?? {}),
                    isStreaming: true, // waiting for tool_result
                  }),
                ),
              );
              break;
            }

            /* -- Tool results -- */
            case "tool_result": {
              const toolCallId = (event.id || "") as string;
              const toolName = (event.name || "") as string;
              const resultValue = typeof event.result === "string"
                ? event.result
                : JSON.stringify(event.result ?? "");

              setMessages((prev) =>
                updateLastMessage(prev, (msg) => {
                  const blocks = msg.blocks.map((b) =>
                    b.type === "tool_call" && (b.id === toolCallId || b.name === toolName)
                      ? { ...b, isStreaming: false }
                      : b,
                  );

                  return {
                    ...msg,
                    blocks: [
                      ...blocks,
                      {
                        type: "tool_result" as const,
                        toolCallId,
                        name: toolName,
                        result: resultValue,
                      },
                    ],
                  };
                }),
              );

              // Refresh the sidebar panel so it reflects tool changes
              void queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
              void queryClient.invalidateQueries({ queryKey: ["workflow-summary", workflowId] });
              break;
            }

            /* -- Input request -- */
            case "input_request": {
              receivedContent = true;
              setMessages((prev) =>
                updateLastMessage(prev, (msg) =>
                  appendBlock(msg, {
                    type: "input_request",
                    inputType: (event.input_type || "text") as "url" | "text" | "email",
                    label: (event.label || "") as string,
                    placeholder: (event.placeholder || undefined) as string | undefined,
                    field: (event.field || "") as string,
                    value: (event.value as string | undefined) || undefined,
                  }),
                ),
              );
              break;
            }

            /* -- Quick-reply buttons -- */
            case "buttons": {
              receivedContent = true;
              const buttons = Array.isArray(event.buttons)
                ? (event.buttons as { label: string; value: string }[])
                : [];
              if (buttons.length > 0) {
                setMessages((prev) =>
                  updateLastMessage(prev, (msg) =>
                    appendBlock(msg, { type: "buttons", buttons }),
                  ),
                );
              }
              break;
            }

            /* -- Error from server -- */
            case "error": {
              receivedContent = true;
              const errorMsg = (event.message || "Unknown server error") as string;
              console.error("[chat] Server error event:", errorMsg);
              setMessages((prev) =>
                updateLastMessage(prev, (msg) => ({
                  ...msg,
                  content: errorMsg,
                  blocks: [
                    ...msg.blocks,
                    { type: "text" as const, text: errorMsg },
                  ],
                })),
              );
              break;
            }

            default:
              console.warn("[chat] Unknown SSE event type:", event.type, event);
              break;
          }
        }
      }

      // If the stream ended without any content, surface the raw response
      if (!receivedContent) {
        const raw = rawChunks.join("");
        console.error("[chat] Stream ended with no content. Raw response:", raw);
        const errorMsg = raw.trim() || "Empty response from server";
        setMessages((prev) =>
          updateLastMessage(prev, (msg) => ({
            ...msg,
            content: errorMsg,
            blocks: [{ type: "text" as const, text: errorMsg }],
          })),
        );
      }
      playDing();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User stopped generation
        setMessages((prev) =>
          updateLastMessage(prev, (msg) => {
            if (msg.content || msg.blocks.length > 0) return msg;
            return { ...msg, content: "Generation stopped.", blocks: [{ type: "text", text: "Generation stopped." }] };
          }),
        );
      } else {
        console.error("[chat] Stream error:", err);
        setMessages((prev) =>
          updateLastMessage(prev, (msg) => ({
            ...msg,
            content: `Something went wrong: ${err instanceof Error ? err.message : "Unknown error"}`,
            blocks: [
              { type: "text" as const, text: `Something went wrong: ${err instanceof Error ? err.message : "Unknown error"}` },
            ],
          })),
        );
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const hasMessages = messages.length > 0;
  const lastMsg = messages[messages.length - 1];
  const showSkeleton = isStreaming && lastMsg?.role === "assistant" && lastMsg.content === "" && lastMsg.blocks.length === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Chat toolbar */}
      {hasMessages && (
        <div className="flex items-center justify-end px-4 py-1.5 border-b border-gray-100 dark:border-white/[0.04] bg-white dark:bg-transparent">
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
            {messages.map((msg, i) =>
              msg.role === "user" ? (
                /* User message: right-aligned pill */
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] bg-brand-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed">
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  </div>
                </div>
              ) : (
                /* Assistant message: no background, left-aligned */
                <div key={i} className="flex gap-3">
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
                    {/* Show skeleton while waiting for first token */}
                    {i === messages.length - 1 && showSkeleton ? (
                      <MessageSkeleton />
                    ) : (
                      <MessageContent message={msg} onSendMessage={sendMessage} isStreaming={isStreaming} />
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500/10 to-brand-600/10 dark:from-brand-400/10 dark:to-brand-500/10 flex items-center justify-center mb-4">
            <SparklesIcon className="w-6 h-6 text-brand-500 dark:text-brand-400" />
          </div>
          <h3 className="font-display font-bold text-gray-900 dark:text-gray-100 text-lg mb-1">Ask about this workflow</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs leading-relaxed">
            I can help you configure, run, or understand how this workflow works.
          </p>
        </div>
      )}

      {/* Scroll-to-bottom pill */}
      {userHasScrolled && hasMessages && (
        <div className="flex justify-center -mt-12 mb-2 relative z-10 pointer-events-none">
          <button
            type="button"
            onClick={() => {
              setUserHasScrolled(false);
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
              placeholder="Ask about this workflow..."
              disabled={isStreaming}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none disabled:opacity-50 py-1.5 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              style={{ maxHeight: 144 }}
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
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
