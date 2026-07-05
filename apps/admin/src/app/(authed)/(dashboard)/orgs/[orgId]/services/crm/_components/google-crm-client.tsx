"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import {
  listGoogleAccounts,
  listGoogleContacts,
  listGoogleMessages,
  type GoogleContactRow,
  type GoogleMessageRow,
} from "@/lib/api";
import { ConnectGoogleButton } from "./connect-google-button";
import { SyncNowButton } from "./sync-now-button";
import { MessagesList, type GoogleMessage } from "./messages-list";
import { ContactsList } from "./contacts-list";
import { useGoogleSync } from "./use-google-sync";

const PAGE_LIMIT = 50;

/**
 * Client-side paginated list on top of a React Query first page. The first page
 * comes from the (cached, revalidated) query; "Load more" appends subsequent
 * cursor pages into local state. Appended pages reset whenever the query's first
 * page is refetched (`resetKey` = the query's `dataUpdatedAt`) so a fresh page-1
 * (e.g. after a sync inserts new rows) never mixes with a stale page-2.
 */
function usePaginated<T>(
  firstItems: T[] | undefined,
  firstCursor: string | null | undefined,
  resetKey: string,
  fetchMore: (cursor: string) => Promise<{ items: T[]; nextCursor: string | null }>,
) {
  const [extra, setExtra] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setExtra([]);
    setCursor(null);
    setError(null);
  }, [resetKey]);

  const items = [...(firstItems ?? []), ...extra];
  const effectiveCursor = cursor ?? firstCursor ?? null;

  async function onLoadMore() {
    if (!effectiveCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await fetchMore(effectiveCursor);
      setExtra((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } catch (err) {
      console.error("[admin] CRM load more failed", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingMore(false);
    }
  }

  return { items, nextCursor: effectiveCursor, onLoadMore, loadingMore, error };
}

export function GoogleCrmClient() {
  // Fire all three reads in parallel on mount (local-first SWR: instant cached
  // paint, silent background revalidation). Accounts is persisted (config-like);
  // the two entity lists are in-memory SWR (the persist-cache invariant forbids
  // persisting lists). Slow poll so the console stays fresh without hammering the
  // cold google-service; idle/hidden tabs pause polling globally.
  const accountsQuery = useAuthQuery(
    ["googleAccounts"],
    () => listGoogleAccounts(),
    pollOptionsSlower,
  );
  const accounts = accountsQuery.data ?? [];
  const isConnected = accounts.length > 0;

  const messagesQuery = useAuthQuery(
    ["googleMessages"],
    () => listGoogleMessages(null, PAGE_LIMIT),
    { ...pollOptionsSlower, enabled: isConnected },
  );
  const contactsQuery = useAuthQuery(
    ["googleContacts"],
    () => listGoogleContacts(null, PAGE_LIMIT),
    { ...pollOptionsSlower, enabled: isConnected },
  );

  const { runSync } = useGoogleSync();

  // Revalidate-on-open: fire ONE silent background sync the first time we know the
  // org is connected, then invalidate the CRM queries (handled inside runSync).
  const syncedRef = useRef(false);
  useEffect(() => {
    if (isConnected && !syncedRef.current) {
      syncedRef.current = true;
      void runSync({ silent: true });
    }
  }, [isConnected, runSync]);

  // Reset appended "Load more" pages only when page-1 CONTENT changes (length +
  // first-row id), never on a no-op background refetch — so a slow poll doesn't
  // silently collapse the pages a user just expanded.
  const msgItems = messagesQuery.data?.items;
  const msgSig = `${msgItems?.length ?? 0}:${msgItems?.[0]?.gmailMessageId ?? msgItems?.[0]?.id ?? ""}`;
  const contactItems = contactsQuery.data?.items;
  const contactSig = `${contactItems?.length ?? 0}:${contactItems?.[0]?.id ?? contactItems?.[0]?.resourceName ?? ""}`;

  const messages = usePaginated<GoogleMessageRow>(
    msgItems,
    messagesQuery.data?.nextCursor,
    msgSig,
    (cursor) => listGoogleMessages(cursor, PAGE_LIMIT),
  );
  const contacts = usePaginated<GoogleContactRow>(
    contactItems,
    contactsQuery.data?.nextCursor,
    contactSig,
    (cursor) => listGoogleContacts(cursor, PAGE_LIMIT),
  );

  const accountsReady = !accountsQuery.isPending;
  // The two lists are a coherent cold group — reveal together, never one-by-one.
  const listsReady =
    !messagesQuery.isPending && !contactsQuery.isPending;

  if (!accountsReady) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-2xl">
          <Skeleton className="h-5 w-40 mb-3" />
          <Skeleton className="h-4 w-56" />
        </div>
        <ListSectionSkeleton title="Recent Gmail messages" />
        <ListSectionSkeleton title="Google contacts" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="font-medium text-gray-900 mb-1">Connect your Google account</h2>
        <p className="text-sm text-gray-500 mb-4">
          Authorize Distribute to read your Gmail messages and Google Contacts.
        </p>
        <ConnectGoogleButton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Accounts card — static frame + labels paint immediately (accounts are known here) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-medium text-gray-900 mb-1">Connected accounts</h2>
            <ul className="space-y-1">
              {accounts.map((acc, idx) => (
                <li key={acc.email ?? `account-${idx}`} className="text-sm text-gray-700">
                  {acc.email !== undefined ? (
                    <code className="font-mono text-xs">{acc.email}</code>
                  ) : (
                    <span className="text-red-600 text-xs">Account {idx} missing email field</span>
                  )}
                  {acc.status !== undefined && (
                    <span className="ml-2 text-xs text-gray-500">{acc.status}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <SyncNowButton />
        </div>
      </div>

      {/* Section frames (headers) are static shell; only the list BODIES gate on
          the coordinated reveal, so both lists appear together, never one-by-one. */}
      <div>
        <h2 className="font-medium text-gray-900 mb-3">Recent Gmail messages</h2>
        {listsReady ? (
          <MessagesList
            items={messages.items as GoogleMessage[]}
            nextCursor={messages.nextCursor}
            onLoadMore={messages.onLoadMore}
            loadingMore={messages.loadingMore}
            loadMoreError={messages.error}
          />
        ) : (
          <ListBodySkeleton />
        )}
      </div>

      <div>
        <h2 className="font-medium text-gray-900 mb-3">Google contacts</h2>
        {listsReady ? (
          <ContactsList
            items={contacts.items}
            nextCursor={contacts.nextCursor}
            onLoadMore={contacts.onLoadMore}
            loadingMore={contacts.loadingMore}
            loadMoreError={contacts.error}
          />
        ) : (
          <ListBodySkeleton />
        )}
      </div>
    </div>
  );
}

function ListSectionSkeleton({ title }: { title: string }) {
  return (
    <div>
      <h2 className="font-medium text-gray-900 mb-3">{title}</h2>
      <ListBodySkeleton />
    </div>
  );
}

function ListBodySkeleton() {
  return (
    <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-2/3 mb-1.5" />
          <Skeleton className="h-3 w-1/2" />
        </li>
      ))}
    </ul>
  );
}
