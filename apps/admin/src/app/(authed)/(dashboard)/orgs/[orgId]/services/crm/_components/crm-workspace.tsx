"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptionsSlower } from "@/lib/query-options";
import {
  listGoogleContacts,
  type GoogleContactRow,
  type GoogleContactLinks,
} from "@/lib/api";
import { ContactLinksEditor } from "./contact-links-editor";
import { ContactThread } from "./contact-thread";

const PAGE_LIMIT = 50;

function contactKey(c: GoogleContactRow): string {
  return c.resourceName ?? c.id ?? "";
}

function initials(c: GoogleContactRow): string {
  const src = c.displayName || c.primaryEmail || "?";
  return src.slice(0, 2).toUpperCase();
}

function linkCount(links: GoogleContactLinks | undefined): number {
  if (!links) return 0;
  return links.orgIds.length + links.brandIds.length + links.featureSlugs.length;
}

/**
 * Contacts CRM: a filterable, paginated contacts table (left) + a detail panel
 * (right) showing the contact's org/brand/feature links editor and the Gmail
 * thread with that contact. Replaces the old two-stacked-lists layout.
 */
export function CrmWorkspace() {
  const [rawFilter, setRawFilter] = useState("");
  const [filter, setFilter] = useState("");
  const [extra, setExtra] = useState<GoogleContactRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Local link overrides applied on save, so the table + panel update instantly.
  const [linkOverrides, setLinkOverrides] = useState<Record<string, GoogleContactLinks>>({});

  // Debounce the filter input.
  useEffect(() => {
    const t = setTimeout(() => setFilter(rawFilter.trim()), 300);
    return () => clearTimeout(t);
  }, [rawFilter]);

  // Reset pagination when the filter changes.
  useEffect(() => {
    setExtra([]);
    setCursor(null);
  }, [filter]);

  const query = useAuthQuery(
    ["googleContacts", filter],
    () => listGoogleContacts(null, PAGE_LIMIT, undefined, { query: filter || undefined }),
    pollOptionsSlower,
  );

  const contacts: GoogleContactRow[] = useMemo(() => {
    const base = query.data ? [...query.data.items, ...extra] : [];
    return base.map((c) => {
      const override = linkOverrides[contactKey(c)];
      return override ? { ...c, links: override } : c;
    });
  }, [query.data, extra, linkOverrides]);

  const nextCursor = extra.length > 0 ? cursor : (query.data?.nextCursor ?? null);
  const selected = contacts.find((c) => contactKey(c) === selectedKey) ?? null;

  async function loadMore() {
    const c = extra.length > 0 ? cursor : query.data?.nextCursor;
    if (!c) return;
    setLoadingMore(true);
    try {
      const page = await listGoogleContacts(c, PAGE_LIMIT, undefined, {
        query: filter || undefined,
      });
      setExtra((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="relative flex h-[calc(100vh-16rem)] min-h-[32rem] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white md:flex-row">
      {/* Left — contacts table */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-gray-200 p-3">
          <input
            type="text"
            value={rawFilter}
            onChange={(e) => setRawFilter(e.target.value)}
            placeholder="Filter contacts by name or email…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {query.isPending ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : query.isError ? (
            <p className="p-4 text-sm text-red-600">Failed to load contacts.</p>
          ) : contacts.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">
              {filter ? "No contacts match your filter." : "No Google contacts synced yet."}
            </p>
          ) : (
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-4 py-2">Contact</th>
                  <th className="px-4 py-2 hidden sm:table-cell">Organization</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contacts.map((c) => {
                  const key = contactKey(c);
                  const n = linkCount(c.links);
                  const isSel = key === selectedKey;
                  return (
                    <tr
                      key={key}
                      onClick={() => setSelectedKey(key)}
                      className={`cursor-pointer ${isSel ? "bg-brand-50" : "hover:bg-gray-50"}`}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                            {initials(c)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-gray-800">
                              {c.displayName || c.primaryEmail || key}
                            </span>
                            {c.primaryEmail && (
                              <span className="block truncate text-xs text-gray-400">
                                {c.primaryEmail}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 hidden sm:table-cell">
                        <span className="block truncate text-gray-600">
                          {c.organization || "—"}
                        </span>
                        {c.jobTitle && (
                          <span className="block truncate text-xs text-gray-400">{c.jobTitle}</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {n > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-brand-50 border border-brand-200 px-2 py-0.5 text-xs text-brand-700">
                            {n} linked
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">Unlinked</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {nextCursor && (
            <div className="p-3">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right — contact detail panel */}
      {selected && (
        <div className="absolute inset-0 flex flex-col overflow-y-auto border-gray-200 bg-white md:static md:w-[26rem] md:border-l">
          <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-4">
            <div className="flex min-w-0 items-center gap-3">
              {selected.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.photoUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-500">
                  {initials(selected)}
                </span>
              )}
              <div className="min-w-0">
                <div className="truncate font-medium text-gray-900">
                  {selected.displayName || selected.primaryEmail || contactKey(selected)}
                </div>
                {selected.primaryEmail && (
                  <div className="truncate text-xs text-gray-400">{selected.primaryEmail}</div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              className="shrink-0 text-gray-400 hover:text-gray-700"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="border-b border-gray-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">Status</h3>
            <ContactLinksEditor
              contact={selected}
              onSaved={(links) =>
                setLinkOverrides((prev) => ({ ...prev, [contactKey(selected)]: links }))
              }
            />
          </div>

          <div className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">Emails</h3>
            <ContactThread email={selected.primaryEmail} />
          </div>
        </div>
      )}
    </div>
  );
}
