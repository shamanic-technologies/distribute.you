"use client";

import { useState } from "react";
import { parseGmailPayload, type GmailMessageShape } from "./parse-gmail-payload";

export interface GoogleMessage extends GmailMessageShape {
  id?: string;
  externalId?: string;
  accountEmail?: string;
}

export interface MessagesPage {
  items: GoogleMessage[];
  nextCursor: string | null;
}

export function MessagesList({ initialPage }: { initialPage: MessagesPage }) {
  const [items, setItems] = useState<GoogleMessage[]>(initialPage.items);
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    setError(null);
    const res = await fetch(
      `/api/v1/orgs/google/messages?limit=50&cursor=${encodeURIComponent(nextCursor)}`,
    );
    if (!res.ok) {
      const body = await res.text();
      console.error("[dashboard] /orgs/google/messages load more failed", res.status, body);
      setError(`Failed to load more: ${res.status}`);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as MessagesPage;
    setItems((prev) => [...prev, ...data.items]);
    setNextCursor(data.nextCursor);
    setLoading(false);
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm">
          No Gmail messages yet. Click &quot;Sync now&quot; to import recent messages.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul className="space-y-2">
        {items.map((msg, idx) => {
          const parsed = parseGmailPayload(msg);
          const key = msg.externalId ?? msg.id ?? `row-${idx}`;
          return (
            <li
              key={key}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {parsed.subject !== null && (
                    <h3 className="font-medium text-gray-900 truncate">
                      {parsed.subject}
                    </h3>
                  )}
                  {parsed.from !== null && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      from {parsed.from}
                    </p>
                  )}
                  {parsed.snippet !== null && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                      {parsed.snippet}
                    </p>
                  )}
                </div>
                {parsed.date !== null && (
                  <time className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {parsed.date}
                  </time>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium text-gray-700"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
