"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import Markdown from "react-markdown";
import {
  ChevronRightIcon,
  WrenchScrewdriverIcon,
  SparklesIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/20/solid";
import { MermaidDiagram } from "./mermaid-diagram";

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

type ContentBlock = TextBlock | ThinkingBlock | ToolCallBlock | ToolResultBlock;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  blocks: ContentBlock[];
}

interface WorkflowChatProps {
  workflowContext: Record<string, unknown>;
  sessionId: string;
}

/* ─── Collapsible wrapper ────────────────────────────────────────────── */

function Collapsible({
  label,
  icon,
  statusIcon,
  isStreaming,
  defaultOpen = false,
  accentColor = "gray",
  children,
}: {
  label: string;
  icon: React.ReactNode;
  statusIcon?: React.ReactNode;
  isStreaming?: boolean;
  defaultOpen?: boolean;
  accentColor?: "gray" | "brand" | "amber";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const colorMap = {
    gray: "bg-gray-50 border-gray-200 text-gray-600",
    brand: "bg-brand-50/60 border-brand-200 text-brand-700",
    amber: "bg-amber-50/60 border-amber-200 text-amber-700",
  };

  return (
    <div className={`my-2 rounded-xl border ${colorMap[accentColor]} overflow-hidden transition-colors`}>
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
        <div className="px-3 pb-3 text-xs whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
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
      label={block.isStreaming ? "Thinking…" : "Thought process"}
      icon={<SparklesIcon className="w-3.5 h-3.5 flex-shrink-0" />}
      statusIcon={!block.isStreaming ? <CheckCircleIcon className="w-3.5 h-3.5 text-amber-500/70" /> : undefined}
      isStreaming={block.isStreaming}
      accentColor="amber"
    >
      <p className="text-amber-800/70 leading-relaxed">{block.thinking || "…"}</p>
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
    <pre className="bg-white/70 rounded-lg p-2.5 overflow-x-auto text-[11px] leading-relaxed font-mono text-gray-700 border border-black/[0.04]">
      {formatted}
    </pre>
  );
}

/* ─── Tool call block ────────────────────────────────────────────────── */

function ToolCallBlockUI({ block, result }: { block: ToolCallBlock; result?: ToolResultBlock }) {
  const friendlyName = block.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const isWaiting = block.isStreaming && !result;
  const statusLabel = isWaiting
    ? `Calling ${friendlyName}…`
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
      statusIcon={result ? <CheckCircleIcon className="w-3.5 h-3.5 text-brand-500/70" /> : undefined}
      isStreaming={isWaiting}
      accentColor="brand"
    >
      <div className="space-y-2.5">
        {block.args && block.args !== "{}" && (
          <div>
            <span className="font-semibold text-brand-800/60 block mb-1 uppercase tracking-wider text-[10px]">
              Input
            </span>
            <PrettyJSON value={block.args} />
          </div>
        )}
        {result && (
          <div>
            <span className="font-semibold text-brand-800/60 block mb-1 uppercase tracking-wider text-[10px]">
              Result
            </span>
            <div className="max-h-40 overflow-y-auto">
              <PrettyJSON value={result.result} />
            </div>
          </div>
        )}
        {isWaiting && !result && (
          <p className="text-brand-600/50 italic text-[11px]">Waiting for result…</p>
        )}
      </div>
    </Collapsible>
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
  code: ({ children }: { children?: React.ReactNode }) => <code className="bg-gray-200/60 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
  pre: ({ children }: { children?: React.ReactNode }) => <pre className="bg-gray-800 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-xs">{children}</pre>,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => <a href={href} className="text-brand-600 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
};

function TextContent({ text }: { text: string }) {
  const segments = parseMessageSegments(text);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "mermaid" ? (
          <MermaidDiagram key={i} chart={seg.value} className="my-3 bg-white rounded-lg p-4 border border-gray-100" />
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

function MessageContent({ message }: { message: ChatMessage }) {
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

export function WorkflowChat({ workflowContext, sessionId }: WorkflowChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea up to 6 lines
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 144) + "px";
  }, [input]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed, blocks: [] };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    // Add empty assistant message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "", blocks: [] }]);

    try {
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          sessionId,
          context: workflowContext,
        }),
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const event = JSON.parse(payload);

            switch (event.type) {
              /* ── Text tokens ─────────────────────────────── */
              case "token": {
                const tokenText = event.content || event.token || "";
                if (!tokenText) break;
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

              /* ── Thinking ────────────────────────────────── */
              case "thinking_start": {
                setMessages((prev) =>
                  updateLastMessage(prev, (msg) =>
                    appendBlock(msg, { type: "thinking", thinking: "", isStreaming: true }),
                  ),
                );
                break;
              }
              case "thinking_delta": {
                const delta = event.thinking || "";
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

              /* ── Tool calls (args arrive complete, no delta/stop) */
              case "tool_call": {
                setMessages((prev) =>
                  updateLastMessage(prev, (msg) =>
                    appendBlock(msg, {
                      type: "tool_call",
                      id: event.id || `tc_${Date.now()}`,
                      name: event.name || "unknown",
                      args: typeof event.args === "string"
                        ? event.args
                        : JSON.stringify(event.args ?? {}),
                      isStreaming: true, // waiting for tool_result
                    }),
                  ),
                );
                break;
              }

              /* ── Tool results ────────────────────────────── */
              case "tool_result": {
                const toolCallId = event.id || "";
                const toolName = event.name || "";
                const resultValue = typeof event.result === "string"
                  ? event.result
                  : JSON.stringify(event.result ?? "");

                setMessages((prev) =>
                  updateLastMessage(prev, (msg) => {
                    // Mark matching tool_call as done
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
                break;
              }

              default:
                break;
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        updateLastMessage(prev, (msg) => ({
          ...msg,
          content: `Sorry, something went wrong: ${err instanceof Error ? err.message : "Unknown error"}`,
          blocks: [
            { type: "text", text: `Sorry, something went wrong: ${err instanceof Error ? err.message : "Unknown error"}` },
          ],
        })),
      );
    } finally {
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
  const showLoadingDots = isStreaming && lastMsg?.role === "assistant" && lastMsg.content === "" && lastMsg.blocks.length === 0;

  return (
    <div className="flex flex-col min-h-0">
      {/* Messages */}
      {hasMessages && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {msg.role === "assistant" ? (
                  <MessageContent message={msg} />
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
                {i === messages.length - 1 && showLoadingDots && (
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex-shrink-0 border-t border-gray-200 bg-white p-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this workflow..."
            disabled={isStreaming}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            style={{ maxHeight: 144 }}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
