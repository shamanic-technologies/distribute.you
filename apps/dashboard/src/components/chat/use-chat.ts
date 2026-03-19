"use client";

import { useState, useCallback, useRef } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  buttons?: ChatButton[];
  inputRequest?: InputRequest;
  isStreaming?: boolean;
}

export interface ChatButton {
  label: string;
  value: string;
}

export interface InputRequest {
  input_type: "url" | "text" | "email";
  label: string;
  placeholder?: string;
  field: string;
}

interface UseChatOptions {
  apiKey: string | null;
  orgId: string | null;
  userId: string | null;
}

export function useChat({ apiKey, orgId, userId }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!apiKey || !orgId || !userId || !content.trim()) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
      };

      // Add placeholder assistant message for streaming
      const assistantId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${API_URL}/v1/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            "x-org-id": orgId,
            "x-user-id": userId,
          },
          body: JSON.stringify({
            message: content.trim(),
            appId: "distribute",
            sessionId: sessionIdRef.current,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Chat request failed: ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

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
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);

              if (event.sessionId) {
                sessionIdRef.current = event.sessionId;
              }

              if (event.type === "token") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + event.content }
                      : m
                  )
                );
              }

              if (event.type === "buttons") {
                console.log("[distribute] buttons SSE event:", event.buttons);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          buttons: event.buttons,
                          // Strip trailing "- [Label]" lines that are now rendered as buttons
                          content: m.content.replace(
                            /(\n\s*-\s*\[.*?\]\s*)+\s*$/,
                            ""
                          ),
                        }
                      : m
                  )
                );
              }

              if (event.type === "input_request") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          inputRequest: {
                            input_type: event.input_type,
                            label: event.label,
                            placeholder: event.placeholder,
                            field: event.field,
                          },
                        }
                      : m
                  )
                );
              }
            } catch {
              // Skip malformed SSE events
            }
          }
        }

        // Mark streaming complete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        );
      } catch (err: any) {
        if (err.name === "AbortError") return;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "Sorry, something went wrong. Please try again.",
                  isStreaming: false,
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, orgId, userId]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    sessionIdRef.current = null;
  }, []);

  return { messages, isLoading, sendMessage, reset };
}
