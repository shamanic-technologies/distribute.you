"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import Markdown from "react-markdown";
import { MermaidDiagram } from "./mermaid-diagram";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface WorkflowChatProps {
  initialMermaid: string;
  initialSummary: string;
  workflowContext: Record<string, unknown>;
  sessionId: string;
}

/** Extract ```mermaid blocks from text and return segments */
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

function MessageContent({ content }: { content: string }) {
  const segments = parseMessageSegments(content);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "mermaid" ? (
          <MermaidDiagram key={i} chart={seg.value} className="my-3 bg-white rounded-lg p-4 border border-gray-100" />
        ) : (
          <Markdown
            key={i}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
              code: ({ children }) => <code className="bg-gray-200/60 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
              pre: ({ children }) => <pre className="bg-gray-800 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-xs">{children}</pre>,
              a: ({ href, children }) => <a href={href} className="text-brand-600 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
            }}
          >
            {seg.value}
          </Markdown>
        )
      )}
    </>
  );
}

export function WorkflowChat({ initialMermaid, initialSummary, workflowContext, sessionId }: WorkflowChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `${initialSummary}\n\nAsk me anything about this workflow — how it works, what each step does, or how the data flows between nodes.`,
    },
  ]);
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
    el.style.height = Math.min(el.scrollHeight, 144) + "px"; // 144px ≈ 6 lines
  }, [input]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    // Add empty assistant message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

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
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `Sorry, I encountered an error: ${errText}`,
          };
          return updated;
        });
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
            if (event.type === "token" && event.token) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + event.token,
                };
                return updated;
              });
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Sorry, something went wrong: ${err instanceof Error ? err.message : "Unknown error"}`,
        };
        return updated;
      });
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

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages — scrollable area fills remaining space */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
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
                <MessageContent content={msg.content} />
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
              {msg.role === "assistant" && msg.content === "" && isStreaming && (
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

      {/* Input — sticky at bottom */}
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
