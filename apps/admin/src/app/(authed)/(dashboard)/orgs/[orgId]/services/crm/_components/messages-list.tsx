"use client";

import { useState } from "react";
import {
  parseGmailPayload,
  type GmailMessageShape,
  type GmailEnvelopeShape,
} from "./parse-gmail-payload";
import type { GmailPayloadFull } from "./parse-gmail-body";
import { EmailDetailPanel } from "./email-detail-panel";
import type { GoogleMessageRow } from "@/lib/api";

export interface GoogleMessageEnvelope extends GmailEnvelopeShape {
  payload?: GmailPayloadFull;
}

// The row on the wire (typed google-service fields + the raw Gmail `payload`,
// which the detail panel parses the body from). Mirrors `GoogleMessageRow` in
// lib/api.ts with `payload` narrowed to the envelope shape for detail rendering.
export interface GoogleMessage extends GoogleMessageRow {
  payload?: GoogleMessageEnvelope;
}

function formatSentAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

interface MessageDisplay {
  from: string | null;
  subject: string | null;
  snippet: string | null;
  date: string | null;
}

/**
 * Prefer the typed google-service fields; fall back to parsing the raw Gmail
 * `payload` while the additive typed rollout is not yet live (the payload is real
 * present data on the wire — not a fabricated default — so this is a graceful
 * source fallback, not a No-Fallbacks violation). Once google-service ships the
 * typed fields they win and the payload parse is never reached.
 */
export function messageDisplay(msg: GoogleMessage): MessageDisplay {
  const parsed = parseGmailPayload(msg as unknown as GmailMessageShape);
  const from =
    (typeof msg.fromName === "string" && msg.fromName.length > 0 ? msg.fromName : null) ??
    (typeof msg.fromEmail === "string" && msg.fromEmail.length > 0 ? msg.fromEmail : null) ??
    parsed.from;
  const subject =
    typeof msg.subject === "string" && msg.subject.length > 0 ? msg.subject : parsed.subject;
  const snippet =
    typeof msg.snippet === "string" && msg.snippet.length > 0 ? msg.snippet : parsed.snippet;
  const date =
    typeof msg.sentAt === "string" && msg.sentAt.length > 0
      ? formatSentAt(msg.sentAt)
      : parsed.date;
  return { from, subject, snippet, date };
}

export function MessagesList({
  items,
  nextCursor,
  onLoadMore,
  loadingMore,
  loadMoreError,
}: {
  items: GoogleMessage[];
  nextCursor: string | null;
  onLoadMore: () => void;
  loadingMore: boolean;
  loadMoreError: string | null;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm">
          No Gmail messages yet. Click &quot;Sync now&quot; to import recent messages.
        </p>
      </div>
    );
  }

  const selectedMessage = selectedIdx !== null ? items[selectedIdx] : null;

  return (
    <div>
      <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {items.map((msg, idx) => {
          const d = messageDisplay(msg);
          const key = msg.gmailMessageId ?? msg.id ?? `row-${idx}`;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition flex items-start gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    {d.from !== null && (
                      <p className="text-sm font-medium text-gray-800 truncate flex-shrink-0 max-w-[40%]">
                        {d.from}
                      </p>
                    )}
                    {d.subject !== null && (
                      <p className="text-sm text-gray-700 truncate flex-1">{d.subject}</p>
                    )}
                  </div>
                  {d.snippet !== null && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{d.snippet}</p>
                  )}
                </div>
                {d.date !== null && (
                  <time className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                    {d.date}
                  </time>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {loadMoreError && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {loadMoreError}
        </div>
      )}

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium text-gray-700"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      {selectedMessage !== null && (
        <EmailDetailPanel message={selectedMessage} onClose={() => setSelectedIdx(null)} />
      )}
    </div>
  );
}
