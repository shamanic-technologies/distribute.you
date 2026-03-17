"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import Markdown from "react-markdown";
import { ChevronRightIcon, WrenchScrewdriverIcon, SparklesIcon } from "@heroicons/react/20/solid";
import { MermaidDiagram } from "./mermaid-diagram";

interface WorkflowChatProps {
  workflowId: string;
  workflowContext: Record<string, unknown>;
  onWorkflowUpdated?: () => void;
}

const TOOL_LABELS: Record<string, string> = {
  getWorkflowDetails: "Fetching workflow details",
  getPrompt: "Fetching prompt template",
  validateWorkflow: "Validating workflow",
  updateWorkflow: "Updating workflow",
  versionPrompt: "Creating prompt version",
};

/** Part shape at runtime — the actual UIMessagePart generic is complex */
interface PartLike {
  type: string;
  text?: string;
  toolName?: string;
  toolCallId?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

/* ─── Collapsible wrapper ────────────────────────────────────────────── */

function Collapsible({
  label,
  icon,
  isStreaming,
  defaultOpen = false,
  accentColor = "gray",
  children,
}: {
  label: string;
  icon: React.ReactNode;
  isStreaming?: boolean;
  defaultOpen?: boolean;
  accentColor?: "gray" | "brand" | "amber";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const colorMap = {
    gray: "bg-gray-50 border-gray-200 text-gray-600",
    brand: "bg-brand-50 border-brand-200 text-brand-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };

  return (
    <div className={`my-2 rounded-lg border ${colorMap[accentColor]} overflow-hidden`}>
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
        {isStreaming && (
          <span className="ml-auto flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-2 text-xs opacity-80 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
          {children}
        </div>
      )}
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

/* ─── Part helpers ────────────────────────────────────────────────────── */

function getPartToolName(part: PartLike): string {
  if (part.toolName) return part.toolName;
  if (part.type.startsWith("tool-")) return part.type.slice(5);
  return "unknown";
}

function getPartState(part: PartLike): string {
  if (part.state) return part.state;
  if (part.output !== undefined) return "result";
  return "call";
}

function isToolPart(part: PartLike): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

function isReasoningPart(part: PartLike): boolean {
  return part.type === "reasoning";
}

/* ─── Tool call collapsible ──────────────────────────────────────────── */

function ToolCallUI({ part }: { part: PartLike }) {
  const toolName = getPartToolName(part);
  const state = getPartState(part);
  const friendlyLabel = TOOL_LABELS[toolName] ?? toolName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const isActive = state === "call" || state === "input-streaming" || state === "partial-call";

  const statusLabel = state === "result"
    ? `${friendlyLabel} done`
    : state === "error"
      ? `${friendlyLabel} failed`
      : `${friendlyLabel}…`;

  let parsedInput: string | null = null;
  if (part.input) {
    try {
      parsedInput = JSON.stringify(part.input, null, 2);
    } catch {
      parsedInput = String(part.input);
    }
  }

  let parsedOutput: string | null = null;
  if (part.output) {
    try {
      parsedOutput = JSON.stringify(part.output, null, 2);
    } catch {
      parsedOutput = String(part.output);
    }
  }

  return (
    <Collapsible
      label={statusLabel}
      icon={<WrenchScrewdriverIcon className="w-3.5 h-3.5 flex-shrink-0" />}
      isStreaming={isActive}
      accentColor="brand"
    >
      {parsedInput && (
        <div className="mb-2">
          <span className="font-semibold block mb-0.5">Input:</span>
          <pre className="bg-white/60 rounded p-2 overflow-x-auto">{parsedInput}</pre>
        </div>
      )}
      {parsedOutput && (
        <div>
          <span className="font-semibold block mb-0.5">Result:</span>
          <pre className="bg-white/60 rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
            {parsedOutput}
          </pre>
        </div>
      )}
      {part.errorText && (
        <div className="text-red-600">
          <span className="font-semibold block mb-0.5">Error:</span>
          {part.errorText}
        </div>
      )}
    </Collapsible>
  );
}

/* ─── Reasoning/thinking collapsible ─────────────────────────────────── */

function ReasoningUI({ part }: { part: PartLike }) {
  const isActive = part.state === "streaming";
  return (
    <Collapsible
      label={isActive ? "Thinking..." : "Thought process"}
      icon={<SparklesIcon className="w-3.5 h-3.5 flex-shrink-0" />}
      isStreaming={isActive}
      accentColor="amber"
    >
      {part.text || "..."}
    </Collapsible>
  );
}

/* ─── Message bubble ─────────────────────────────────────────────────── */

function MessageBubble({ message, isStreaming }: { message: UIMessage; isStreaming: boolean }) {
  const isUser = message.role === "user";
  const parts = message.parts as PartLike[];

  const hasText = parts.some((p) => p.type === "text" && p.text && p.text.length > 0);
  const hasTools = parts.some(isToolPart);
  const hasReasoning = parts.some(isReasoningPart);
  const isEmpty = !isUser && !hasText && !hasTools && !hasReasoning;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-800"
        }`}
      >
        {parts.map((part, i) => {
          if (part.type === "text" && part.text) {
            return isUser
              ? <span key={i} className="whitespace-pre-wrap">{part.text}</span>
              : <TextContent key={i} text={part.text} />;
          }
          if (isToolPart(part)) {
            return <ToolCallUI key={i} part={part} />;
          }
          if (isReasoningPart(part)) {
            return <ReasoningUI key={i} part={part} />;
          }
          return null;
        })}

        {isEmpty && isStreaming && (
          <span className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Main chat component ────────────────────────────────────────────── */

export function WorkflowChat({ workflowId, workflowContext, onWorkflowUpdated }: WorkflowChatProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/v1/chat",
        body: { workflowId, workflowContext },
      })
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    onFinish: ({ message }) => {
      const parts = message.parts as PartLike[];
      const hasUpdate = parts.some(
        (p) => isToolPart(p) && getPartToolName(p) === "updateWorkflow" && getPartState(p) === "result"
      );
      if (hasUpdate) onWorkflowUpdated?.();
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
    setInput("");
    await sendMessage({ text: trimmed });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col min-h-0">
      {hasMessages && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-3">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isStreaming={isStreaming && msg.id === messages[messages.length - 1]?.id}
            />
          ))}
          {error && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
                Sorry, something went wrong: {error.message}
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex-shrink-0 border-t border-gray-200 bg-white p-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this workflow, view prompts, or request changes…"
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
