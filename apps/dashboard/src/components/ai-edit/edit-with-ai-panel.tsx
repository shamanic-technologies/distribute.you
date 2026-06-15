"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  SparklesIcon,
  XMarkIcon,
  WrenchScrewdriverIcon,
  ArrowUpIcon,
} from "@heroicons/react/20/solid";

/**
 * Edit-with-AI — RIGHT-PANEL CHAT MOCKUP.
 *
 * Visually mirrors the real campaign prefill chat (sparkles header, message
 * bubbles, tool-call cards, input bar) but the assistant runs ENTIRELY
 * client-side: the host page passes an `onSend` handler that interprets the
 * message, mutates its own mock state, and returns an assistant turn (reply +
 * the tool calls it "ran"). There is NO LLM and NO backend — this exists to
 * test the Edit-with-AI UX over the personas / brand-profile mockups. When the
 * real thing is wired, swap `onSend` for an AI-SDK `useChat` against
 * `/api/v1/chat` with server-defined tools.
 */

export interface AiToolCall {
  /** Tool name, shown in the tool-call card (e.g. "create_persona"). */
  tool: string;
  /** One-line human summary of what the tool did. */
  summary: string;
}

export interface AiTurn {
  reply: string;
  toolCalls?: AiToolCall[];
}

/** Interpret a user message, apply side-effects on the host state, return the turn. */
export type AiHandler = (input: string) => AiTurn;

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolCalls?: AiToolCall[];
}

let msgCounter = 0;
const nextMsgId = () => `m-${++msgCounter}`;

export function EditWithAIPanel({
  open,
  onClose,
  title,
  intro,
  suggestions,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  intro: string;
  suggestions: string[];
  onSend: AiHandler;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: nextMsgId(), role: "assistant", text: intro },
  ]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  // Esc closes the panel.
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
    if (!value) return;
    const turn = onSend(value);
    setMessages((prev) => [
      ...prev,
      { id: nextMsgId(), role: "user", text: value },
      { id: nextMsgId(), role: "assistant", text: turn.reply, toolCalls: turn.toolCalls },
    ]);
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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-gray-100 text-gray-500 transition"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className="max-w-[85%] space-y-2">
                <div
                  className={
                    m.role === "user"
                      ? "rounded-2xl rounded-br-sm bg-brand-600 text-white text-sm px-3.5 py-2 whitespace-pre-line"
                      : "rounded-2xl rounded-bl-sm bg-gray-100 text-gray-800 text-sm px-3.5 py-2 whitespace-pre-line"
                  }
                >
                  {m.text}
                </div>
                {m.toolCalls?.map((tc, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
                  >
                    <WrenchScrewdriverIcon className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" />
                    <span className="min-w-0">
                      <span className="font-mono text-[11px] text-gray-500">{tc.tool}</span>
                      <span className="block text-gray-700">{tc.summary}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Suggestion chips — only before the first user message. */}
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
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send"
              className="shrink-0 rounded-lg bg-brand-600 p-1.5 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ArrowUpIcon className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-gray-400 text-center">
            Mockup assistant — runs locally, no changes are saved.
          </p>
        </form>
      </div>
    </>
  );
}
