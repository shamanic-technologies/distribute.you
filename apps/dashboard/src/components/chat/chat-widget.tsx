"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { getOrCreateSessionKey, getMe } from "@/lib/api";
import { useChat } from "./use-chat";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";

export function ChatWidget() {
  const { getToken } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(true);

  const { messages, isLoading, sendMessage } = useChat({ apiKey, orgId, userId });

  // Fetch or create a Default API key on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const [keyResult, meResult] = await Promise.all([
          getOrCreateSessionKey(token),
          getMe(token),
        ]);

        if (!cancelled) {
          if (keyResult.key) setApiKey(keyResult.key);
          setOrgId(meResult.orgId);
          setUserId(meResult.userId);
        }
      } catch (err) {
        console.error("Failed to initialize chat:", err);
      } finally {
        if (!cancelled) setKeyLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const handleButtonClick = useCallback(
    (value: string) => {
      sendMessage(value);
    },
    [sendMessage]
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40 md:hidden"
            onClick={handleClose}
          />

          <div className="fixed bottom-0 right-0 md:bottom-24 md:right-6 z-50 w-full md:w-96 h-[80vh] md:h-[600px] md:max-h-[80vh] bg-white md:rounded-xl shadow-xl border border-gray-200 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden">
                  <img
                    src="/favicon.jpg"
                    alt="Foxy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-display font-semibold text-sm text-gray-900">
                    Foxy
                  </p>
                  <p className="text-xs text-gray-500">MCP Factory Assistant</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            {keyLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ChatMessages
                messages={messages}
                onButtonClick={handleButtonClick}
              />
            )}

            {/* Input */}
            <ChatInput onSend={sendMessage} disabled={isLoading || keyLoading} />
          </div>
        </>
      )}

      {/* FAB — Foxy icon when closed, X when open (rendered last to stay on top) */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary-500 text-white shadow-lg hover:bg-primary-600 hover:shadow-xl transition-all flex items-center justify-center"
      >
        {isOpen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        ) : (
          <div className="w-9 h-9 rounded-full overflow-hidden">
            <img src="/favicon.jpg" alt="Foxy" className="w-full h-full object-cover" />
          </div>
        )}
      </button>
    </>
  );
}
