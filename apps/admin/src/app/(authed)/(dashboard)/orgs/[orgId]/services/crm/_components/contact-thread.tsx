"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listGoogleMessages, type GoogleMessageRow } from "@/lib/api";
import { EmailDetailPanel } from "./email-detail-panel";
import type { GoogleMessage } from "./messages-list";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The Gmail thread with one contact, newest first. Loads the first page keyed on
 * the contact email; "Load more" appends via cursor. Ordering (sentAt desc) is
 * owned by google-service when `participant` is set.
 */
export function ContactThread({ email }: { email: string | null | undefined }) {
  const [extra, setExtra] = useState<GoogleMessageRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openMsg, setOpenMsg] = useState<GoogleMessageRow | null>(null);

  const query = useAuthQuery(
    ["googleMessages", email ?? ""],
    () => listGoogleMessages(null, 30, undefined, { participant: email ?? undefined }),
    { enabled: !!email },
  );

  if (!email) {
    return <p className="text-sm text-gray-400">No email address for this contact.</p>;
  }

  if (query.isPending) {
    return <div className="h-24 animate-pulse rounded-lg bg-gray-100" />;
  }

  if (query.isError) {
    return <p className="text-sm text-red-600">Failed to load emails.</p>;
  }

  const firstPage = query.data;
  const messages = [...firstPage.items, ...extra];
  const nextCursor = extra.length > 0 ? cursor : firstPage.nextCursor;

  async function loadMore() {
    const c = extra.length > 0 ? cursor : firstPage.nextCursor;
    if (!c) return;
    setLoadingMore(true);
    try {
      const page = await listGoogleMessages(c, 30, undefined, {
        participant: email ?? undefined,
      });
      setExtra((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  if (messages.length === 0) {
    return <p className="text-sm text-gray-400">No emails exchanged with this contact yet.</p>;
  }

  return (
    <div className="space-y-2">
      {messages.map((m) => (
        <button
          type="button"
          key={m.id ?? m.gmailMessageId}
          onClick={() => setOpenMsg(m)}
          className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-medium text-gray-800">
              {m.subject || "(no subject)"}
            </span>
            <span className="shrink-0 text-xs text-gray-400">{formatDate(m.sentAt)}</span>
          </div>
          <div className="mt-0.5 truncate text-xs text-gray-500">
            {m.fromName || m.fromEmail || ""}
          </div>
          {m.snippet && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{m.snippet}</p>}
        </button>
      ))}

      {nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}

      {openMsg && (
        // The row carries the raw Gmail `payload` (kept via `.passthrough()`), from
        // which EmailDetailPanel parses + sanitizes the full body.
        <EmailDetailPanel
          message={openMsg as GoogleMessage}
          onClose={() => setOpenMsg(null)}
        />
      )}
    </div>
  );
}
