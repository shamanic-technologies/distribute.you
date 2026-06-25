"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronRightIcon,
  WrenchScrewdriverIcon,
  SparklesIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  XCircleIcon,
} from "@heroicons/react/20/solid";

/**
 * Shared chat message-part renderers — progress / thinking / tool-call
 * indicators ported from the admin WorkflowChat so the dashboard
 * EditWithAIChat (audience + brand-profile editors) shows the same
 * "what is the assistant doing" affordances.
 *
 * Mermaid + the token/context gauge are intentionally NOT included here:
 * the audience / brand-profile editors don't emit diagrams, and the token
 * counter was explicitly excluded from this surface.
 */

/* ─── Collapsible wrapper ────────────────────────────────────────────── */

export function Collapsible({
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

export function PrettyJSON({ value }: { value: string }) {
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

/* ─── Markdown text ──────────────────────────────────────────────────── */

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
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
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

export function TextContent({ text }: { text: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {text}
    </Markdown>
  );
}

/* ─── Thinking block ─────────────────────────────────────────────────── */

export function ThinkingBlockUI({
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

export function getToolName(part: { type: string; toolName?: string }): string {
  if (part.toolName) return part.toolName;
  if (part.type.startsWith("tool-")) return part.type.slice(5);
  return "unknown";
}

export function ToolInvocationUI({
  part,
}: {
  part: {
    type: string;
    toolCallId: string;
    toolName?: string;
    state: string;
    input?: unknown;
    output?: unknown;
  };
}) {
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
        typeof part.output === "string" ? JSON.parse(part.output) : part.output;
      isError = parsed.success === false || !!parsed.error;
    } catch {
      // not JSON
    }
  }

  const argsStr =
    typeof part.input === "string" ? part.input : JSON.stringify(part.input ?? {});
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
          <p className="opacity-40 italic text-[11px]">Waiting for result...</p>
        )}
      </div>
    </Collapsible>
  );
}

/* ─── Skeleton shimmer ───────────────────────────────────────────────── */

export function MessageSkeleton() {
  return (
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
  );
}

/* ─── Bouncing dots (avatar / inline progress) ───────────────────────── */

export function BouncingDots({ className = "bg-white" }: { className?: string }) {
  return (
    <span className="flex gap-0.5">
      <span
        className={`w-1 h-1 rounded-full ${className} animate-bounce`}
        style={{ animationDelay: "0ms" }}
      />
      <span
        className={`w-1 h-1 rounded-full ${className} animate-bounce`}
        style={{ animationDelay: "150ms" }}
      />
      <span
        className={`w-1 h-1 rounded-full ${className} animate-bounce`}
        style={{ animationDelay: "300ms" }}
      />
    </span>
  );
}
